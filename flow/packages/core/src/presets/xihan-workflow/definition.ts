/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程文档与 XiHan 工作流引擎定义 JSON（WorkflowDefinitionJsonSerializer 的格式）的互转。
// 节点：activityType ↔ type，name ↔ label，其余字段（properties、retryPolicy、timeoutSeconds、continueOnError…）↔ data。
// 连线：sourceNodeId / targetNodeId ↔ source / target，name ↔ label，其余字段（condition、priority、isDefault…）↔ data。
// 定义上 nodes、transitions 之外的字段 ↔ 文档 data。设计器自己的东西放在 extraProperties：
// designerLayout 是节点左上角坐标 { 节点 id: { x, y } }，designerEdges 是连线的拐点与外观，designerExtensions 是各扩展的数据，
// 都是 JSON 字符串。

import type { JsonObject, JsonValue } from '@xihan-ui/core/json'
import type { FlowNodeTypeRegistry } from '../../registry'
import type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowNode, FlowPoint, FlowSize } from '../../schema'
import { cloneJson, isPlainObject } from '@xihan-ui/core/json'
import { layered } from '@xihan-ui/viz/graph'
import { FLOW_DOCUMENT_VERSION } from '../../schema'
import { xihanWorkflowNodeSize } from './activities'

/** 引擎定义里的节点。 */
export interface XihanWorkflowNode {
  readonly id: string
  readonly name?: string
  readonly activityType: string
  /** 活动属性，键名由各活动约定。 */
  readonly properties?: JsonObject
  readonly retryPolicy?: { readonly maxAttempts?: number, readonly firstDelaySeconds?: number, readonly backoffFactor?: number } | null
  readonly timeoutSeconds?: number | null
  readonly continueOnError?: boolean
}

/** 引擎定义里的连线。 */
export interface XihanWorkflowTransition {
  readonly id?: string
  readonly name?: string | null
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly condition?: string | null
  readonly priority?: number
  readonly isDefault?: boolean
}

/** 引擎的流程定义；没列出的字段原样保留。 */
export interface XihanWorkflowDefinition {
  readonly id?: string
  readonly code?: string
  readonly name?: string
  readonly version?: number
  readonly description?: string | null
  readonly category?: string | null
  readonly status?: string
  readonly enableCompensation?: boolean
  readonly nodes?: readonly XihanWorkflowNode[]
  readonly transitions?: readonly XihanWorkflowTransition[]
  readonly variables?: readonly JsonObject[]
  readonly tenantId?: number | null
  readonly creationTime?: string
  readonly publishTime?: string | null
  /** 扩展属性，值都是字符串。 */
  readonly extraProperties?: Readonly<Record<string, string>>
}

/** fromWorkflowDefinition 的选项。 */
export interface FromWorkflowDefinitionOptions {
  /** 节点尺寸先从这里按活动类型取，取不到再用预设的尺寸。 */
  readonly nodeTypes?: FlowNodeTypeRegistry
}

const LAYOUT_KEY = 'designerLayout'
const EDGES_KEY = 'designerEdges'
const EXTENSIONS_KEY = 'designerExtensions'
const DESIGNER_KEYS = new Set([LAYOUT_KEY, EDGES_KEY, EXTENSIONS_KEY])

interface EdgeLook {
  readonly vertices?: readonly FlowPoint[]
  readonly style?: FlowEdgeStyle
}

interface ExtensionData {
  readonly document?: JsonObject
  readonly nodes?: Readonly<Record<string, JsonObject>>
  readonly edges?: Readonly<Record<string, JsonObject>>
}

function fail(message: string): never {
  throw new TypeError(`[flow] workflow definition: ${message}`)
}

/** 去掉值为 null 的键（引擎里可空字段的 null 与缺省同义），其余深拷贝。 */
function withoutNulls(object: Readonly<Record<string, unknown>>, omit: readonly string[]): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(object)) {
    if (value !== null && value !== undefined && !omit.includes(key))
      result[key] = cloneJson(value as JsonValue)
  }
  return result
}

/** 读 extraProperties 里的一份 JSON；不是合法 JSON 对象时当作没有（这些只关乎画面，不影响流程语义）。 */
function readExtra(extra: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> | undefined {
  const text = extra[key]
  if (typeof text !== 'string')
    return undefined
  try {
    const value = JSON.parse(text) as unknown
    return isPlainObject(value) ? value : undefined
  }
  catch {
    return undefined
  }
}

function isPoint(value: unknown): value is FlowPoint {
  return isPlainObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y)
}

/** 节点属性按预设的属性描述规范化：DurationSeconds 为数字时写成字符串（引擎对数字与表达式字符串同样处理）。 */
function normalizeProperties(activityType: string, properties: JsonObject): JsonObject {
  if (activityType === 'Delay' && typeof properties.DurationSeconds === 'number')
    return { ...properties, DurationSeconds: String(properties.DurationSeconds) }
  return properties
}

/**
 * 引擎定义换成流程文档。节点坐标取 extraProperties.designerLayout，有节点没有坐标时按连线自左向右分层排出它的坐标；
 * 尺寸按活动类型取。连线没有 id 时按「源->目标#序号」补上。
 * Delay 的 DurationSeconds 为数字时换成字符串，其余字段原样搬，值为 null 的字段去掉。结构不对时抛 TypeError。
 */
export function fromWorkflowDefinition(definition: XihanWorkflowDefinition, options: FromWorkflowDefinitionOptions = {}): FlowDocument {
  if (!isPlainObject(definition))
    fail('must be an object')
  const raw = definition as unknown as Readonly<Record<string, unknown>>
  const rawNodes = raw.nodes ?? []
  const rawTransitions = raw.transitions ?? []
  if (!Array.isArray(rawNodes))
    fail('nodes must be an array')
  if (!Array.isArray(rawTransitions))
    fail('transitions must be an array')
  const extra = isPlainObject(raw.extraProperties) ? raw.extraProperties : {}
  const layout = readExtra(extra, LAYOUT_KEY) ?? {}
  const looks = readExtra(extra, EDGES_KEY) ?? {}
  const extensions = (readExtra(extra, EXTENSIONS_KEY) ?? {}) as ExtensionData

  const sizeOf = (type: string): FlowSize => options.nodeTypes?.get(type)?.size ?? xihanWorkflowNodeSize(type)
  const placed: (FlowPoint | undefined)[] = []
  const nodes = rawNodes.map((value: unknown, index: number) => {
    if (!isPlainObject(value) || typeof value.id !== 'string' || typeof value.activityType !== 'string')
      fail(`nodes[${index}] needs string id and activityType`)
    const { id, activityType } = value
    const at = layout[id]
    placed.push(isPoint(at) ? { x: at.x, y: at.y } : undefined)
    const data = withoutNulls(value, ['id', 'name', 'activityType'])
    if (isPlainObject(data.properties)) {
      const properties = normalizeProperties(activityType, data.properties)
      if (Object.keys(properties).length === 0)
        delete data.properties
      else
        data.properties = properties
    }
    const node: FlowNode = {
      id,
      type: activityType,
      x: 0,
      y: 0,
      ...sizeOf(activityType),
      ...(typeof value.name === 'string' && value.name !== '' ? { label: value.name } : {}),
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(isPlainObject(extensions.nodes?.[id]) ? { extensions: cloneJson(extensions.nodes[id]) } : {}),
    }
    return node
  })

  const edges = rawTransitions.map((value: unknown, index: number): FlowEdge => {
    if (!isPlainObject(value) || typeof value.sourceNodeId !== 'string' || typeof value.targetNodeId !== 'string')
      fail(`transitions[${index}] needs string sourceNodeId and targetNodeId`)
    const id = typeof value.id === 'string' && value.id !== '' ? value.id : `${value.sourceNodeId}->${value.targetNodeId}#${index + 1}`
    const data = withoutNulls(value, ['id', 'name', 'sourceNodeId', 'targetNodeId'])
    const look = isPlainObject(looks[id]) ? looks[id] as EdgeLook : {}
    const vertices = Array.isArray(look.vertices) && look.vertices.every(isPoint) ? look.vertices.map(point => ({ x: point.x, y: point.y })) : undefined
    return {
      id,
      source: { node: value.sourceNodeId },
      target: { node: value.targetNodeId },
      ...(typeof value.name === 'string' && value.name !== '' ? { label: value.name } : {}),
      ...(isPlainObject(look.style) && typeof look.style.dashed === 'boolean' ? { style: { dashed: look.style.dashed } } : {}),
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(vertices && vertices.length > 0 ? { vertices } : {}),
      ...(isPlainObject(extensions.edges?.[id]) ? { extensions: cloneJson(extensions.edges[id]) } : {}),
    }
  })

  const positioned = placeMissing(nodes, edges, placed)
  const otherExtra = Object.fromEntries(Object.entries(extra).filter(([key, text]) => !DESIGNER_KEYS.has(key) && typeof text === 'string')) as Record<string, string>
  const data = withoutNulls(raw, ['nodes', 'transitions', 'extraProperties'])
  if (Object.keys(otherExtra).length > 0)
    data.extraProperties = otherExtra
  return {
    version: FLOW_DOCUMENT_VERSION,
    nodes: positioned,
    edges,
    ...(Object.keys(data).length > 0 ? { data } : {}),
    ...(isPlainObject(extensions.document) ? { extensions: cloneJson(extensions.document) } : {}),
  }
}

/** 没有坐标的节点按连线自左向右分层排出坐标；全部都有坐标时原样返回。 */
function placeMissing(nodes: readonly FlowNode[], edges: readonly FlowEdge[], placed: readonly (FlowPoint | undefined)[]): FlowNode[] {
  if (placed.every(point => point !== undefined))
    return nodes.map((node, index) => ({ ...node, ...placed[index]! }))
  const indexOf = new Map(nodes.map((node, index) => [node.id, index]))
  const links = edges.flatMap((edge) => {
    const source = indexOf.get(edge.source.node)
    const target = indexOf.get(edge.target.node)
    return source === undefined || target === undefined ? [] : [{ source, target }]
  })
  const layout = layered(nodes, links, { direction: 'LR', nodeGap: 48, layerGap: 96 })
  return nodes.map((node, index) => {
    const center = layout.nodes[index]!
    return { ...node, ...(placed[index] ?? { x: Math.round(center.x - node.width / 2), y: Math.round(center.y - node.height / 2) }) }
  })
}

function stringify(value: JsonObject): string | undefined {
  return Object.keys(value).length === 0 ? undefined : JSON.stringify(value)
}

/**
 * 流程文档换成引擎定义：文档 data 里的字段放在前面，接着 nodes、transitions 与 extraProperties。
 * 节点坐标写进 extraProperties.designerLayout；有拐点或外观的连线写进 designerEdges，有扩展数据的写进 designerExtensions。
 * 节点总有 name 与 properties（引擎的缺省分别是空串与空字典）。
 */
export function toWorkflowDefinition(document: FlowDocument): XihanWorkflowDefinition {
  const layout: Record<string, JsonObject> = {}
  const looks: Record<string, JsonObject> = {}
  const nodeExtensions: Record<string, JsonObject> = {}
  const edgeExtensions: Record<string, JsonObject> = {}
  const nodes = document.nodes.map((node) => {
    layout[node.id] = { x: Math.round(node.x), y: Math.round(node.y) }
    if (node.extensions)
      nodeExtensions[node.id] = cloneJson(node.extensions)
    const data = node.data ? cloneJson(node.data) : {}
    return { id: node.id, name: node.label ?? '', activityType: node.type, ...data, properties: isPlainObject(data.properties) ? data.properties : {} }
  })
  const transitions = document.edges.map((edge) => {
    const look: Record<string, JsonValue> = {}
    if (edge.vertices && edge.vertices.length > 0)
      look.vertices = edge.vertices.map(point => ({ x: point.x, y: point.y }))
    if (edge.style)
      look.style = cloneJson(edge.style as JsonObject)
    if (Object.keys(look).length > 0)
      looks[edge.id] = look
    if (edge.extensions)
      edgeExtensions[edge.id] = cloneJson(edge.extensions)
    return {
      id: edge.id,
      ...(edge.label === undefined ? {} : { name: edge.label }),
      sourceNodeId: edge.source.node,
      targetNodeId: edge.target.node,
      ...(edge.data ? cloneJson(edge.data) : {}),
    }
  })
  const { extraProperties, ...data } = document.data ? cloneJson(document.data) : {}
  const extensions: Record<string, JsonValue> = {}
  if (document.extensions)
    extensions.document = cloneJson(document.extensions)
  if (Object.keys(nodeExtensions).length > 0)
    extensions.nodes = nodeExtensions
  if (Object.keys(edgeExtensions).length > 0)
    extensions.edges = edgeExtensions
  const designer = Object.entries({ [LAYOUT_KEY]: stringify(layout), [EDGES_KEY]: stringify(looks), [EXTENSIONS_KEY]: stringify(extensions) })
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
  return {
    ...data,
    nodes,
    transitions,
    extraProperties: { ...(isPlainObject(extraProperties) ? extraProperties as Record<string, string> : {}), ...Object.fromEntries(designer) },
  } as XihanWorkflowDefinition
}
