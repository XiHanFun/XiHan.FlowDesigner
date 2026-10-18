/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// XiHan 工作流的 17 种节点类型、按源节点类型的出线属性与流程定义级属性。
// 节点的引擎属性放在 data.properties 下，键名与引擎一致；超时、失败续行、重试策略放在 data 下，字段名与定义 JSON 一致。

import type { FlowEdgeStyleRule, FlowNodeTypeDefinition, FlowPropertyControl, FlowPropertyDescriptor } from '../../registry'
import type { XihanWorkflowActivityType, XihanWorkflowCategory, XihanWorkflowGroup, XihanWorkflowPropertyKey, XihanWorkflowTexts } from './texts'

/** 受理人规则的编辑方式：值是 { type, values } 的数组，编辑器由宿主提供（按 control.kind 登记）。 */
export const XIHAN_WORKFLOW_ASSIGNEE_RULES = 'xihan-workflow.assignee-rules'

/** 只能连出、不能连入的节点。 */
const ENTRY_TYPES = new Set<string>(['Start'])
/** 不再流转的节点：结束类活动。 */
const TERMINAL_TYPES = new Set<string>(['End', 'Terminate', 'Fault'])
/** 忽略连线条件、沿全部出线流转的节点。 */
const FAN_OUT_TYPES = new Set<string>(['Parallel'])
/** 会挂起等待的节点，节点超时只对它们生效。 */
const SUSPENDING_TYPES = new Set<string>(['UserTask', 'WaitSignal', 'SubWorkflow', 'ForEach'])
/** 执行实际工作的节点，可以配置重试与失败续行。 */
const WORK_TYPES = new Set<string>(['Delay', 'SubWorkflow', 'ForEach', 'UserTask', 'SetVariable', 'Http', 'Script', 'PublishEvent', 'WaitSignal', 'Log'])

interface PropertySpec {
  readonly key: XihanWorkflowPropertyKey
  /** 编辑方式；给了 options 时为下拉，选项文案取 options 文案表里「键.取值」那一条，没有时显示取值。 */
  readonly control?: FlowPropertyControl
  readonly options?: readonly string[]
  readonly group?: XihanWorkflowGroup
  readonly required?: boolean
  readonly visibleWhen?: FlowPropertyDescriptor['visibleWhen']
}

interface ActivitySpec {
  readonly type: XihanWorkflowActivityType
  readonly category: XihanWorkflowCategory
  readonly properties: readonly PropertySpec[]
}

const text = (placeholder?: string): FlowPropertyControl => (placeholder === undefined ? { kind: 'text' } : { kind: 'text', placeholder })
const multiline: FlowPropertyControl = { kind: 'text', multiline: true }
const json: FlowPropertyControl = { kind: 'json' }
const boolean: FlowPropertyControl = { kind: 'boolean' }
const tags: FlowPropertyControl = { kind: 'tags' }
const version: FlowPropertyControl = { kind: 'number', integer: true, min: 1 }
const assigneeRules: FlowPropertyControl = { kind: XIHAN_WORKFLOW_ASSIGNEE_RULES }

const ACTIVITIES: readonly ActivitySpec[] = [
  { type: 'Start', category: 'control', properties: [] },
  { type: 'End', category: 'control', properties: [{ key: 'Outcome', options: ['approved', 'rejected'] }] },
  { type: 'Decision', category: 'control', properties: [] },
  { type: 'Parallel', category: 'control', properties: [] },
  { type: 'Join', category: 'control', properties: [{ key: 'Mode', options: ['WaitAll', 'WaitAny'] }] },
  { type: 'Delay', category: 'control', properties: [{ key: 'DurationSeconds', control: text('300'), required: true }] },
  {
    type: 'SubWorkflow',
    category: 'control',
    properties: [
      { key: 'DefinitionCode', control: text(), required: true },
      { key: 'DefinitionVersion', control: version },
      { key: 'Variables', control: json },
      { key: 'VariableExpressions', control: json },
      { key: 'WaitForCompletion', control: boolean },
      { key: 'ResultVariable', control: text() },
      { key: 'FailOnChildFault', control: boolean },
    ],
  },
  {
    type: 'ForEach',
    category: 'control',
    properties: [
      { key: 'ItemsExpression', control: text('orderLines') },
      { key: 'ItemVariableName', control: text('item') },
      { key: 'DefinitionCode', control: text(), required: true },
      { key: 'DefinitionVersion', control: version },
      { key: 'Parallel', control: boolean },
      { key: 'FailFast', control: boolean },
      { key: 'Variables', control: json },
      { key: 'ResultVariable', control: text() },
    ],
  },
  { type: 'Terminate', category: 'control', properties: [{ key: 'Reason', control: text() }] },
  { type: 'Fault', category: 'control', properties: [{ key: 'Message', control: text() }] },
  {
    type: 'UserTask',
    category: 'human',
    properties: [
      { key: 'Title', control: text('{{billNo}}'), group: 'basic' },
      { key: 'AssigneeRules', control: assigneeRules, group: 'participants' },
      { key: 'Assignees', control: tags, group: 'participants' },
      { key: 'AssigneesExpression', control: text(), group: 'participants' },
      { key: 'ExcludeStarter', control: boolean, group: 'participants' },
      { key: 'CompletionPolicy', options: ['Any', 'All', 'Sequential'], group: 'participants' },
      { key: 'EmptyAssigneeStrategy', options: ['Fault', 'AutoApprove', 'AutoReject', 'Fallback'], group: 'participants' },
      {
        key: 'FallbackAssigneeRules',
        control: assigneeRules,
        group: 'participants',
        required: true,
        visibleWhen: { path: ['data', 'properties', 'EmptyAssigneeStrategy'], equals: 'Fallback' },
      },
      { key: 'CcRules', control: assigneeRules, group: 'participants' },
      { key: 'CcUserIds', control: tags, group: 'participants' },
      { key: 'FormData', control: json, group: 'form' },
      { key: 'AllowedOutcomes', control: tags, group: 'form' },
    ],
  },
  { type: 'SetVariable', category: 'data', properties: [{ key: 'Values', control: json }, { key: 'Expressions', control: json }] },
  {
    type: 'Http',
    category: 'integration',
    properties: [
      { key: 'Url', control: text('https://api.example.com/orders/{{orderId}}'), required: true },
      { key: 'Method', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { key: 'Headers', control: json },
      { key: 'Body', control: multiline },
      { key: 'ContentType', control: text('application/json') },
      { key: 'TimeoutSeconds', control: { kind: 'number', integer: true, min: 1, unit: 's' } },
      { key: 'ResultVariable', control: text() },
      { key: 'FailOnErrorStatus', control: boolean },
    ],
  },
  { type: 'Script', category: 'integration', properties: [{ key: 'Code', control: multiline, required: true }, { key: 'ResultVariable', control: text() }] },
  { type: 'PublishEvent', category: 'event', properties: [{ key: 'EventName', control: text(), required: true }, { key: 'Payload', control: json }] },
  { type: 'WaitSignal', category: 'event', properties: [{ key: 'SignalName', control: text('order-paid'), required: true }, { key: 'AcceptAnyCorrelation', control: boolean }] },
  {
    type: 'Log',
    category: 'tool',
    properties: [
      { key: 'Message', control: text() },
      { key: 'Level', options: ['Debug', 'Information', 'Warning', 'Error'] },
    ],
  },
]

/** 节点在画布上的尺寸：开始与结束类小一些，其余（含宿主自定义的活动）一样大。 */
export function xihanWorkflowNodeSize(type: string): { width: number, height: number } {
  return ENTRY_TYPES.has(type) || TERMINAL_TYPES.has(type) ? { width: 120, height: 40 } : { width: 160, height: 48 }
}

function controlOf(spec: PropertySpec, texts: XihanWorkflowTexts): FlowPropertyControl {
  if (spec.options === undefined)
    return spec.control!
  const labels: Readonly<Record<string, string>> = texts.options
  return { kind: 'select', options: spec.options.map(value => ({ value, label: labels[`${spec.key}.${value}`] ?? value })) }
}

function descriptor(spec: PropertySpec, texts: XihanWorkflowTexts): FlowPropertyDescriptor {
  return {
    path: ['data', 'properties', spec.key],
    control: controlOf(spec, texts),
    group: spec.group ?? 'basic',
    label: texts.properties[spec.key],
    ...(spec.required ? { required: true } : {}),
    ...(spec.visibleWhen ? { visibleWhen: spec.visibleWhen } : {}),
  }
}

/** 节点超时、失败续行与重试策略。 */
function executionProperties(type: string, texts: XihanWorkflowTexts): FlowPropertyDescriptor[] {
  if (!WORK_TYPES.has(type))
    return []
  const label = (key: XihanWorkflowPropertyKey): string => texts.properties[key]
  const list: FlowPropertyDescriptor[] = []
  if (SUSPENDING_TYPES.has(type))
    list.push({ path: ['data', 'timeoutSeconds'], control: { kind: 'number', integer: true, min: 1, unit: 's' }, group: 'execution', label: label('timeoutSeconds') })
  list.push(
    { path: ['data', 'continueOnError'], control: boolean, group: 'execution', label: label('continueOnError') },
    { path: ['data', 'retryPolicy', 'maxAttempts'], control: { kind: 'number', integer: true, min: 1 }, group: 'execution', label: label('retryPolicy.maxAttempts') },
    { path: ['data', 'retryPolicy', 'firstDelaySeconds'], control: { kind: 'number', integer: true, min: 0, unit: 's' }, group: 'execution', label: label('retryPolicy.firstDelaySeconds') },
    { path: ['data', 'retryPolicy', 'backoffFactor'], control: { kind: 'number', min: 1 }, group: 'execution', label: label('retryPolicy.backoffFactor') },
  )
  return list
}

/** 从这类节点连出的连线的属性：条件分支有条件、优先级与默认分支；并行分支忽略条件；结束类没有出线。 */
function outgoingEdges(type: string, texts: XihanWorkflowTexts): FlowPropertyDescriptor[] | undefined {
  if (TERMINAL_TYPES.has(type) || FAN_OUT_TYPES.has(type))
    return undefined
  const condition: FlowPropertyDescriptor = { path: ['data', 'condition'], control: { kind: 'text', placeholder: 'amount > 1000' }, label: texts.properties.condition }
  if (type !== 'Decision')
    return [condition]
  return [
    condition,
    { path: ['data', 'priority'], control: { kind: 'number', integer: true }, label: texts.properties.priority },
    { path: ['data', 'isDefault'], control: boolean, label: texts.properties.isDefault },
  ]
}

/** 条件分支的出线外观：默认分支画成虚线。 */
const DECISION_EDGE_STYLES: readonly FlowEdgeStyleRule[] = [{ when: { path: ['data', 'isDefault'], equals: true }, style: { dashed: true } }]

/** 按文案生成 17 种节点类型。 */
export function xihanWorkflowNodeTypes(texts: XihanWorkflowTexts): FlowNodeTypeDefinition[] {
  return ACTIVITIES.map((spec): FlowNodeTypeDefinition => {
    const { type } = spec
    const outgoing = outgoingEdges(type, texts)
    return {
      type,
      label: texts.activities[type],
      category: spec.category,
      size: xihanWorkflowNodeSize(type),
      ports: ENTRY_TYPES.has(type) ? 'out' : TERMINAL_TYPES.has(type) ? 'in' : 'both',
      ...(ENTRY_TYPES.has(type) ? { entry: true, minCount: 1, maxCount: 1 } : {}),
      ...(TERMINAL_TYPES.has(type) ? { terminal: true } : {}),
      properties: [
        { path: ['label'], control: { kind: 'text' }, group: 'basic', label: texts.properties.name },
        ...spec.properties.map(property => descriptor(property, texts)),
        ...executionProperties(type, texts),
      ],
      ...(outgoing ? { outgoingEdges: outgoing } : {}),
      ...(type === 'Decision' ? { outgoingEdgeStyles: DECISION_EDGE_STYLES } : {}),
    }
  })
}

/** 各活动类型在 data.properties 下读的键，供一致性核对。 */
export function xihanWorkflowPropertyKeys(): Readonly<Record<XihanWorkflowActivityType, readonly string[]>> {
  return Object.fromEntries(ACTIVITIES.map(spec => [spec.type, spec.properties.map(property => property.key)])) as unknown as Record<XihanWorkflowActivityType, readonly string[]>
}

/** 流程定义级属性：编码、名称、描述、分类、补偿与启动变量。 */
export function xihanWorkflowDocumentProperties(texts: XihanWorkflowTexts): FlowPropertyDescriptor[] {
  const label = texts.properties
  return [
    { path: ['data', 'code'], control: { kind: 'text' }, group: 'basic', label: label.code, required: true },
    { path: ['data', 'name'], control: { kind: 'text' }, group: 'basic', label: label.name, required: true },
    { path: ['data', 'category'], control: { kind: 'text' }, group: 'basic', label: label.category },
    { path: ['data', 'description'], control: multiline, group: 'basic', label: label.description },
    { path: ['data', 'enableCompensation'], control: boolean, group: 'execution', label: label.enableCompensation },
    { path: ['data', 'variables'], control: json, group: 'basic', label: label.variables },
  ]
}
