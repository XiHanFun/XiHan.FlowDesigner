/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowEdge, FlowNode, FlowNodeTypeDefinition, FlowNodeTypeRegistry, JsonObject, JsonValue } from '../../src'
import { createNodeTypeRegistry } from '../../src'

/** 工作流活动节点类型：节点 type 即活动类型，活动属性位于 data.properties。 */
export const workflowNodeTypes: readonly FlowNodeTypeDefinition[] = [
  { type: 'Start', category: 'control', icon: 'lucide:play', size: { width: 160, height: 48 }, ports: 'out', entry: true, minCount: 1, maxCount: 1 },
  {
    type: 'End',
    category: 'control',
    size: { width: 160, height: 48 },
    ports: 'in',
    terminal: true,
    properties: [
      { path: ['properties', 'Outcome'], editor: 'select', options: [{ value: 'approved', label: 'outcome_approved' }, { value: 'rejected', label: 'outcome_rejected' }] },
    ],
  },
  { type: 'Terminate', category: 'control', size: { width: 160, height: 48 }, ports: 'in', terminal: true, properties: [{ path: ['properties', 'Reason'], editor: 'text' }] },
  { type: 'Fault', category: 'control', size: { width: 160, height: 48 }, ports: 'in', terminal: true, properties: [{ path: ['properties', 'Message'], editor: 'text' }] },
  { type: 'Decision', category: 'control', size: { width: 160, height: 48 }, ports: 'both' },
  {
    type: 'Join',
    category: 'control',
    size: { width: 160, height: 48 },
    ports: 'both',
    properties: [{ path: ['properties', 'Mode'], editor: 'select', options: [{ value: 'WaitAll' }, { value: 'WaitAny' }] }],
  },
  {
    type: 'UserTask',
    category: 'human',
    icon: 'lucide:user-check',
    size: { width: 200, height: 64 },
    ports: 'both',
    defaults: { data: { properties: { CompletionPolicy: 'Any' } } },
    meta: { outcomes: ['approved', 'rejected', 'timeout'] },
    properties: [
      { path: ['properties', 'AssigneeRules'], editor: 'assignees', group: 'participants', required: true },
      {
        path: ['properties', 'CompletionPolicy'],
        editor: 'select',
        group: 'participants',
        defaultValue: 'Any',
        options: [{ value: 'Any' }, { value: 'All' }, { value: 'Sequential' }],
      },
      {
        path: ['properties', 'EmptyAssigneeStrategy'],
        editor: 'select',
        group: 'participants',
        defaultValue: 'Fault',
        options: [{ value: 'Fault' }, { value: 'AutoApprove' }, { value: 'AutoReject' }, { value: 'Fallback' }],
      },
      {
        path: ['properties', 'FallbackAssigneeRules'],
        editor: 'assignees',
        group: 'participants',
        required: true,
        visibleWhen: {
          any: [
            { path: ['properties', 'EmptyAssigneeStrategy'], equals: 'Fallback' },
            { path: ['properties', 'FallbackAssigneeRules'], filled: true },
          ],
        },
      },
      { path: ['properties', 'Title'], editor: 'text', group: 'basic', meta: { placeholder: '单据 {{billNo}} 审批' } },
      { path: ['properties', 'AllowedOutcomes'], editor: 'tags', group: 'form' },
      { path: ['retryPolicy'], editor: 'retry', group: 'execution' },
      { path: ['timeoutSeconds'], editor: 'number', group: 'execution' },
      { path: ['continueOnError'], editor: 'boolean', group: 'execution' },
    ],
  },
  {
    type: 'Http',
    category: 'integration',
    size: { width: 200, height: 64 },
    ports: 'both',
    properties: [
      { path: ['properties', 'Url'], editor: 'text', required: true },
      { path: ['properties', 'Method'], editor: 'select', options: [{ value: 'GET' }, { value: 'POST' }] },
    ],
  },
]

export const workflowRegistry: FlowNodeTypeRegistry = createNodeTypeRegistry(workflowNodeTypes)

interface DefinitionNode {
  id: string
  name?: string
  activityType: string
  properties?: JsonObject
  retryPolicy?: JsonObject | null
  timeoutSeconds?: number | null
  continueOnError?: boolean
}

interface DefinitionTransition {
  id: string
  name?: string | null
  sourceNodeId: string
  targetNodeId: string
  condition?: string | null
  priority?: number
  isDefault?: boolean
}

/** 后端流程定义 JSON（camelCase）。 */
export interface WorkflowDefinitionJson {
  [key: string]: unknown
  nodes: DefinitionNode[]
  transitions: DefinitionTransition[]
  extraProperties: Record<string, string>
}

const LAYOUT_KEY = 'designerLayout'

/** 后端流程定义 → 流程图文档：画布坐标取自 extraProperties.designerLayout，其余定义字段放入文档 data。 */
export function fromDefinition(definition: WorkflowDefinitionJson): FlowDocument {
  const { nodes, transitions, extraProperties, ...rest } = definition
  const { [LAYOUT_KEY]: layoutJson, ...otherExtra } = extraProperties
  const layout = (layoutJson ? JSON.parse(layoutJson) : {}) as Record<string, { x: number, y: number }>

  const flowNodes: FlowNode[] = nodes.map((node) => {
    const nodeType = workflowRegistry.get(node.activityType)!
    const data: Record<string, JsonValue> = { properties: node.properties ?? {} }
    if (node.retryPolicy !== undefined)
      data.retryPolicy = node.retryPolicy
    if (node.timeoutSeconds !== undefined)
      data.timeoutSeconds = node.timeoutSeconds
    if (node.continueOnError !== undefined)
      data.continueOnError = node.continueOnError
    return {
      id: node.id,
      type: node.activityType,
      x: layout[node.id]?.x ?? 0,
      y: layout[node.id]?.y ?? 0,
      width: nodeType.size.width,
      height: nodeType.size.height,
      ...(node.name === undefined ? {} : { label: node.name }),
      data,
    }
  })

  const flowEdges: FlowEdge[] = transitions.map((transition) => {
    const data: Record<string, JsonValue> = {}
    for (const key of ['name', 'condition', 'priority', 'isDefault'] as const) {
      if (transition[key] !== undefined)
        data[key] = transition[key]
    }
    const label = transition.isDefault ? 'default' : (transition.name || transition.condition || '')
    return {
      id: transition.id,
      source: { node: transition.sourceNodeId },
      target: { node: transition.targetNodeId },
      ...(label ? { label } : {}),
      ...(transition.isDefault ? { style: { dashed: true } } : {}),
      data,
    }
  })

  return {
    version: 1,
    nodes: flowNodes,
    edges: flowEdges,
    data: { ...(rest as JsonObject), extraProperties: otherExtra },
  }
}

/** 流程图文档 → 后端流程定义。 */
export function toDefinition(document: FlowDocument): WorkflowDefinitionJson {
  const { extraProperties, ...rest } = (document.data ?? {}) as { extraProperties?: Record<string, string> } & JsonObject
  const layout: Record<string, { x: number, y: number }> = {}
  const nodes = document.nodes.map((node): DefinitionNode => {
    layout[node.id] = { x: node.x, y: node.y }
    const data = (node.data ?? {}) as Omit<DefinitionNode, 'id' | 'activityType' | 'name'>
    return {
      id: node.id,
      ...(node.label === undefined ? {} : { name: node.label }),
      activityType: node.type,
      ...data,
    }
  })
  const transitions = document.edges.map((edge): DefinitionTransition => ({
    id: edge.id,
    sourceNodeId: edge.source.node,
    targetNodeId: edge.target.node,
    ...(edge.data as Omit<DefinitionTransition, 'id' | 'sourceNodeId' | 'targetNodeId'>),
  }))
  return {
    ...rest,
    nodes,
    transitions,
    extraProperties: { ...extraProperties, [LAYOUT_KEY]: JSON.stringify(layout) },
  }
}

/** 一份审批流程定义：开始 → 审批 → 网关 → 通过 / 驳回，网关带默认分支。 */
export function approvalDefinition(): WorkflowDefinitionJson {
  return {
    id: 'def-1',
    code: 'leave',
    name: '请假审批',
    version: 3,
    description: null,
    category: 'hr',
    status: 0,
    enableCompensation: false,
    variables: [{ name: 'days', type: 'number', required: true, defaultValue: null, description: '天数' }],
    tenantId: null,
    creationTime: '2026-10-01T00:00:00Z',
    publishTime: null,
    nodes: [
      { id: 'start', name: '开始', activityType: 'Start', properties: {} },
      {
        id: 'approve',
        name: '主管审批',
        activityType: 'UserTask',
        properties: { AssigneeRules: [{ kind: 'starterManager' }], CompletionPolicy: 'Any', Title: '{{starter}} 的请假' },
        retryPolicy: { maxAttempts: 3, firstDelaySeconds: 10, backoffFactor: 2 },
        timeoutSeconds: 86400,
        continueOnError: false,
      },
      { id: 'gate', name: '结果', activityType: 'Decision', properties: {} },
      { id: 'ok', name: '通过', activityType: 'End', properties: { Outcome: 'approved' } },
      { id: 'no', name: '驳回', activityType: 'End', properties: { Outcome: 'rejected' } },
    ],
    transitions: [
      { id: 't1', sourceNodeId: 'start', targetNodeId: 'approve', priority: 0 },
      { id: 't2', sourceNodeId: 'approve', targetNodeId: 'gate', priority: 0 },
      { id: 't3', name: '同意', sourceNodeId: 'gate', targetNodeId: 'ok', condition: 'outcome == "approved"', priority: 1 },
      { id: 't4', sourceNodeId: 'gate', targetNodeId: 'no', priority: 2, isDefault: true },
    ],
    extraProperties: {
      owner: 'hr-team',
      [LAYOUT_KEY]: JSON.stringify({ start: { x: 60, y: 80 }, approve: { x: 320, y: 72 }, gate: { x: 600, y: 80 }, ok: { x: 860, y: 0 }, no: { x: 860, y: 160 } }),
    },
  }
}
