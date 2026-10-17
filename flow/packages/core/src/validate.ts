/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject, JsonPath } from '@xihan-ui/core/json'
import type { IssueParamValue, IssueSeverity, SchemaIssueTarget } from '@xihan-ui/designer-kit/schema'
import type { GraphLink } from '@xihan-ui/viz/graph'
import type { FlowCoreExtension } from './extensions'
import type { FlowEdgeEnd, FlowIssue, FlowValidationIssueCode } from './issues'
import type { FlowNodeType, FlowNodeTypeRegistry, FlowPort } from './registry'
import type { FlowDocument, FlowEndpoint, FlowNode } from './schema'
import { checkExtensionData, runExtensionRules } from '@xihan-ui/designer-kit'
import { checkProperties } from '@xihan-ui/designer-kit/properties'
import { withSeverity } from '@xihan-ui/designer-kit/schema'
import { reachableFrom } from '@xihan-ui/viz/graph'
import { createFlowModel } from './extensions'
import { portAllows } from './registry'

/** 各问题码的缺省严重程度。 */
export const DEFAULT_ISSUE_SEVERITY: Readonly<Record<FlowValidationIssueCode, IssueSeverity>> = {
  'node.duplicate-id': 'error',
  'node.unknown-type': 'error',
  'edge.duplicate-id': 'error',
  'edge.dangling': 'error',
  'edge.unknown-port': 'error',
  'edge.invalid-direction': 'error',
  'edge.self-loop': 'error',
  'edge.target-not-allowed': 'error',
  'edge.source-not-allowed': 'error',
  'node.max-incoming': 'error',
  'node.max-outgoing': 'error',
  'port.max-connections': 'error',
  'type.min-count': 'error',
  'type.max-count': 'error',
  'node.isolated': 'warning',
  'node.missing-incoming': 'warning',
  'node.missing-outgoing': 'warning',
  'node.unreachable': 'warning',
  'required': 'error',
  'invalid-type': 'error',
  'out-of-range': 'error',
  'not-integer': 'error',
  'invalid-option': 'error',
  'invalid-color': 'error',
  'invalid-value': 'error',
  'unknown-key': 'error',
  'unknown-control': 'error',
}

/** 校验选项。 */
export interface FlowValidateOptions {
  /** 节点类型、属性、编辑方式与规则都从这组扩展来，内置扩展自动排在最前；与设计器、查看器的 extensions 是同一份。 */
  readonly extensions?: readonly FlowCoreExtension[]
  /** 按问题码覆盖严重程度，off 表示不报告；扩展规则的问题码也认。 */
  readonly severity?: Readonly<Partial<Record<FlowValidationIssueCode | (string & {}), IssueSeverity | 'off'>>>
}

/** 连接检查可能给出的问题码。 */
export type FlowConnectionIssueCode = Extract<
  FlowValidationIssueCode,
  | 'node.unknown-type'
  | 'edge.dangling'
  | 'edge.unknown-port'
  | 'edge.invalid-direction'
  | 'edge.self-loop'
  | 'edge.target-not-allowed'
  | 'edge.source-not-allowed'
  | 'node.max-incoming'
  | 'node.max-outgoing'
  | 'port.max-connections'
>

/** 一条连接问题；end 指出问题出在哪一端，自环问题不带 end。 */
export interface FlowConnectionProblem {
  readonly code: FlowConnectionIssueCode
  readonly end?: FlowEdgeEnd
  readonly params: JsonObject
}

/** 连接检查选项。 */
export interface FlowConnectionCheckOptions {
  /** 统计现有连接数时排除的连线 id，重新连接时传入被拖动的连线。 */
  readonly ignoreEdge?: string
}

type EndProblem = Pick<FlowConnectionProblem, 'code' | 'params'>

const ENDS: readonly FlowEdgeEnd[] = ['source', 'target']

/**
 * 解析端点实际连接的端口：指定了端口时按 id 查找，否则取第一个允许该端的端口。
 */
export function resolveEndpointPort(nodeType: FlowNodeType, endpoint: FlowEndpoint, end: FlowEdgeEnd): FlowPort | undefined {
  if (endpoint.port !== undefined)
    return nodeType.ports.find(port => port.id === endpoint.port)
  return nodeType.ports.find(port => portAllows(port, end))
}

/**
 * 检查在 source 与 target 之间新增一条连线是否违反端口与连接约束，返回全部问题；空数组表示允许连接。
 */
export function checkConnection(
  document: FlowDocument,
  registry: FlowNodeTypeRegistry,
  source: FlowEndpoint,
  target: FlowEndpoint,
  options: FlowConnectionCheckOptions = {},
): FlowConnectionProblem[] {
  const problems: FlowConnectionProblem[] = []
  const endpoints = { source, target }
  const nodes: Partial<Record<FlowEdgeEnd, FlowNode>> = {}
  const types: Partial<Record<FlowEdgeEnd, FlowNodeType>> = {}
  const ports: Partial<Record<FlowEdgeEnd, FlowPort>> = {}

  for (const end of ENDS) {
    const endpoint = endpoints[end]
    const node = document.nodes.find(item => item.id === endpoint.node)
    if (!node) {
      problems.push({ code: 'edge.dangling', end, params: { node: endpoint.node } })
      continue
    }
    nodes[end] = node
    const nodeType = registry.get(node.type)
    if (!nodeType) {
      problems.push({ code: 'node.unknown-type', end, params: { type: node.type } })
      continue
    }
    types[end] = nodeType
    const inspected = inspectEnd(nodeType, endpoint, end)
    if (inspected.problem)
      problems.push({ ...inspected.problem, end })
    else
      ports[end] = inspected.port
  }

  for (const problem of pairProblems(nodes.source, nodes.target, types.source, types.target))
    problems.push(problem)

  const existing = document.edges.filter(edge => edge.id !== options.ignoreEdge)
  const sourceRule = types.source?.connection
  if (nodes.source && sourceRule?.maxOutgoing !== undefined) {
    const count = existing.filter(edge => edge.source.node === source.node).length + 1
    if (count > sourceRule.maxOutgoing)
      problems.push({ code: 'node.max-outgoing', end: 'source', params: { max: sourceRule.maxOutgoing, count } })
  }
  const targetRule = types.target?.connection
  if (nodes.target && targetRule?.maxIncoming !== undefined) {
    const count = existing.filter(edge => edge.target.node === target.node).length + 1
    if (count > targetRule.maxIncoming)
      problems.push({ code: 'node.max-incoming', end: 'target', params: { max: targetRule.maxIncoming, count } })
  }

  for (const end of ENDS) {
    const port = ports[end]
    const nodeType = types[end]
    if (!port || !nodeType || port.maxConnections === undefined)
      continue
    const nodeId = endpoints[end].node
    let count = 1
    for (const edge of existing) {
      for (const edgeEnd of ENDS) {
        const endpoint = edge[edgeEnd]
        if (endpoint.node === nodeId && resolveEndpointPort(nodeType, endpoint, edgeEnd) === port)
          count++
      }
    }
    if (count > port.maxConnections)
      problems.push({ code: 'port.max-connections', end, params: { port: port.id, max: port.maxConnections, count } })
  }

  return problems
}

/**
 * 按扩展合出的流程模型校验文档结构，返回全部问题，每条都带上严重程度。
 * 覆盖重复 id、未知类型、悬空引用、端口方向、自环、允许的连接类型、入度 / 出度与端口连接数、
 * 类型个数、孤立 / 缺少入线或出线 / 从入口不可达的节点，节点、连线与流程定义级属性（显示中的必填与编辑方式的取值），
 * 文档与各对象上扩展数据的形状，以及各扩展的规则。
 * 问题落在节点上时路径为 ['nodes', 下标]，落在连线上时为 ['edges', 下标]（指明一端时再加 source / target），
 * 并带 target；类型个数与流程定义级属性的问题落在文档上。重复 id 的节点只按首次出现的那个参与引用解析与连通性分析。
 * 扩展冲突时抛 DesignerExtensionError。
 */
export function validateDocument(document: FlowDocument, options: FlowValidateOptions = {}): FlowIssue[] {
  const model = createFlowModel(options.extensions)
  const registry = model.nodeTypes
  const issues: FlowIssue[] = []
  interface Location { readonly path: JsonPath, readonly target?: SchemaIssueTarget }
  const report = (code: FlowValidationIssueCode, location: Location, params?: JsonObject): void => {
    issues.push({ code, ...location, ...(params === undefined || Object.keys(params).length === 0 ? {} : { params: params as Readonly<Record<string, IssueParamValue>> }) })
  }
  const nodeAt = (index: number): Location => ({ path: ['nodes', index], target: { kind: 'node', id: document.nodes[index]!.id } })
  const edgeAt = (index: number, end?: FlowEdgeEnd): Location => ({
    path: end === undefined ? ['edges', index] : ['edges', index, end],
    target: { kind: 'edge', id: document.edges[index]!.id },
  })
  const documentLevel: Location = { path: [] }

  const nodeIndex = new Map<string, number>()
  const types: (FlowNodeType | undefined)[] = []
  document.nodes.forEach((node, index) => {
    if (nodeIndex.has(node.id))
      report('node.duplicate-id', nodeAt(index), { id: node.id })
    else
      nodeIndex.set(node.id, index)
    const nodeType = registry.get(node.type)
    types.push(nodeType)
    if (!nodeType)
      report('node.unknown-type', nodeAt(index), { type: node.type })
  })

  const incoming = document.nodes.map(() => 0)
  const outgoing = document.nodes.map(() => 0)
  const links: GraphLink[] = []
  const portLoad = new Map<FlowPort, Map<number, number>>()
  const addPortLoad = (port: FlowPort, index: number): void => {
    const loads = portLoad.get(port) ?? new Map<number, number>()
    loads.set(index, (loads.get(index) ?? 0) + 1)
    portLoad.set(port, loads)
  }

  const edgeIds = new Set<string>()
  document.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id))
      report('edge.duplicate-id', edgeAt(index), { id: edge.id })
    edgeIds.add(edge.id)

    const ends: Partial<Record<FlowEdgeEnd, number>> = {}
    for (const end of ENDS) {
      const endpoint = edge[end]
      const nodeIndexOfEnd = nodeIndex.get(endpoint.node)
      if (nodeIndexOfEnd === undefined) {
        report('edge.dangling', edgeAt(index, end), { node: endpoint.node })
        continue
      }
      ends[end] = nodeIndexOfEnd
      const nodeType = types[nodeIndexOfEnd]
      if (!nodeType)
        continue
      const inspected = inspectEnd(nodeType, endpoint, end)
      if (inspected.problem)
        report(inspected.problem.code, edgeAt(index, end), inspected.problem.params)
      else if (inspected.port)
        addPortLoad(inspected.port, nodeIndexOfEnd)
    }

    const { source, target } = ends
    if (source !== undefined)
      outgoing[source]!++
    if (target !== undefined)
      incoming[target]!++
    if (source === undefined || target === undefined)
      return
    links.push({ source, target })
    for (const problem of pairProblems(document.nodes[source], document.nodes[target], types[source], types[target]))
      report(problem.code, edgeAt(index, problem.end), problem.params)
  })

  const primary = (index: number): boolean => nodeIndex.get(document.nodes[index]!.id) === index

  document.nodes.forEach((_, index) => {
    const nodeType = types[index]
    if (!nodeType || !primary(index))
      return
    const rule = nodeType.connection
    if (rule?.maxIncoming !== undefined && incoming[index]! > rule.maxIncoming)
      report('node.max-incoming', nodeAt(index), { max: rule.maxIncoming, count: incoming[index]! })
    if (rule?.maxOutgoing !== undefined && outgoing[index]! > rule.maxOutgoing)
      report('node.max-outgoing', nodeAt(index), { max: rule.maxOutgoing, count: outgoing[index]! })
    for (const port of nodeType.ports) {
      const count = portLoad.get(port)?.get(index) ?? 0
      if (port.maxConnections !== undefined && count > port.maxConnections)
        report('port.max-connections', nodeAt(index), { port: port.id, max: port.maxConnections, count })
    }
  })

  const typeCounts = new Map<string, number>()
  for (const node of document.nodes)
    typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1)
  for (const nodeType of registry.types) {
    const count = typeCounts.get(nodeType.type) ?? 0
    if (nodeType.minCount !== undefined && count < nodeType.minCount)
      report('type.min-count', documentLevel, { type: nodeType.type, min: nodeType.minCount, count })
    if (nodeType.maxCount !== undefined && count > nodeType.maxCount)
      report('type.max-count', documentLevel, { type: nodeType.type, max: nodeType.maxCount, count })
  }

  const connectable = (index: number): boolean => primary(index) && (types[index]?.ports.length ?? 0) > 0
  const isolated = (index: number): boolean => incoming[index] === 0 && outgoing[index] === 0
  document.nodes.forEach((_, index) => {
    const nodeType = types[index]
    if (!nodeType || !connectable(index))
      return
    if (isolated(index)) {
      report('node.isolated', nodeAt(index))
      return
    }
    if (incoming[index] === 0 && !nodeType.entry && nodeType.ports.some(port => portAllows(port, 'target')))
      report('node.missing-incoming', nodeAt(index))
    if (outgoing[index] === 0 && !nodeType.terminal && nodeType.ports.some(port => portAllows(port, 'source')))
      report('node.missing-outgoing', nodeAt(index))
  })

  const entries = document.nodes
    .map((_, index) => index)
    .filter(index => connectable(index) && types[index]!.entry === true)
  if (entries.length > 0) {
    const reached = reachableFrom(document.nodes.length, links, entries)
    document.nodes.forEach((_, index) => {
      if (connectable(index) && !isolated(index) && !reached[index])
        report('node.unreachable', nodeAt(index))
    })
  }

  const { controls } = model
  issues.push(...checkProperties(model.documentProperties, document as unknown as JsonObject, { controls }))
  issues.push(...checkExtensionData(document as unknown as JsonObject))

  document.nodes.forEach((node, index) => {
    if (!primary(index))
      return
    issues.push(...checkExtensionData(node as unknown as JsonObject, ['nodes', index]).map(issue => ({ ...issue, target: nodeAt(index).target })))
    const nodeType = types[index]
    if (nodeType?.properties)
      issues.push(...checkProperties(nodeType.properties, node as unknown as JsonObject, { ...nodeAt(index), controls }))
  })

  const checked = new Set<string>()
  document.edges.forEach((edge, index) => {
    if (checked.has(edge.id))
      return
    checked.add(edge.id)
    issues.push(...checkExtensionData(edge as unknown as JsonObject, ['edges', index]).map(issue => ({ ...issue, target: edgeAt(index).target })))
    const sourceIndex = nodeIndex.get(edge.source.node)
    const sourceType = sourceIndex === undefined ? undefined : document.nodes[sourceIndex]!.type
    issues.push(...checkProperties(model.edgePropertiesOf(sourceType), edge as unknown as JsonObject, { ...edgeAt(index), controls }))
  })

  issues.push(...runExtensionRules(model.extensions, document, { nodeTypes: registry }))

  return withSeverity(issues, DEFAULT_ISSUE_SEVERITY, options.severity)
}

function inspectEnd(nodeType: FlowNodeType, endpoint: FlowEndpoint, end: FlowEdgeEnd): { port?: FlowPort, problem?: EndProblem } {
  const port = resolveEndpointPort(nodeType, endpoint, end)
  if (endpoint.port !== undefined && !port)
    return { problem: { code: 'edge.unknown-port', params: { port: endpoint.port } } }
  if (!port || !portAllows(port, end))
    return { problem: { code: 'edge.invalid-direction', params: endpoint.port === undefined ? {} : { port: endpoint.port } } }
  return { port }
}

function pairProblems(
  source: FlowNode | undefined,
  target: FlowNode | undefined,
  sourceType: FlowNodeType | undefined,
  targetType: FlowNodeType | undefined,
): FlowConnectionProblem[] {
  if (!source || !target)
    return []
  const problems: FlowConnectionProblem[] = []
  if (source.id === target.id && sourceType && !sourceType.connection?.allowSelfLoop)
    problems.push({ code: 'edge.self-loop', params: { node: source.id } })
  const allowedTargets = sourceType?.connection?.allowedTargets
  if (allowedTargets && !allowedTargets.includes(target.type))
    problems.push({ code: 'edge.target-not-allowed', end: 'target', params: { sourceType: source.type, targetType: target.type } })
  const allowedSources = targetType?.connection?.allowedSources
  if (allowedSources && !allowedSources.includes(source.type))
    problems.push({ code: 'edge.source-not-allowed', end: 'source', params: { sourceType: source.type, targetType: target.type } })
  return problems
}
