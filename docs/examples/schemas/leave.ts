/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 自定义节点类型：请假流程用自己的四种节点——发起、审批、抄送、归档。审批人是一种自定义的编辑方式，
// 一条规则要求审批节点连出一条驳回。

import type { FlowCoreExtension, FlowDocument, FlowNodeTypeDefinition } from '@xihan-flow/core'

/** 能选的审批人。 */
export const PEOPLE: readonly string[] = ['张三', '李四', '王五']

// #region node-types
const nodeTypes: readonly FlowNodeTypeDefinition[] = [
  {
    type: 'apply',
    label: '发起',
    category: 'leave',
    size: { width: 120, height: 40 },
    ports: 'out',
    entry: true,
    maxCount: 1,
  },
  {
    type: 'approve',
    label: '审批',
    category: 'leave',
    size: { width: 160, height: 48 },
    ports: 'both',
    defaults: { label: '审批' },
    properties: [
      { path: ['label'], control: { kind: 'text' }, label: '名称', group: 'basic', required: true },
      { path: ['data', 'approver'], control: { kind: 'leave.person' }, label: '审批人', group: 'basic', required: true },
      { path: ['data', 'days'], control: { kind: 'number', integer: true, min: 1 }, label: '超过几天才审批', group: 'rule' },
    ],
    outgoingEdges: [
      {
        path: ['data', 'result'],
        control: { kind: 'select', options: [{ value: 'agree', label: '同意' }, { value: 'reject', label: '驳回' }] },
        label: '审批结果',
      },
    ],
  },
  {
    type: 'notify',
    label: '抄送',
    category: 'leave',
    size: { width: 140, height: 40 },
    ports: 'both',
    properties: [
      { path: ['label'], control: { kind: 'text' }, label: '名称', group: 'basic' },
      { path: ['data', 'to'], control: { kind: 'tags' }, label: '抄送给', group: 'basic' },
    ],
  },
  {
    type: 'archive',
    label: '归档',
    category: 'leave',
    size: { width: 120, height: 40 },
    ports: 'in',
    terminal: true,
  },
]
// #endregion node-types

// #region control
/** 审批人这种编辑方式：取值要是名单里的一位。 */
const controls: FlowCoreExtension['controls'] = {
  'leave.person': { check: value => (typeof value === 'string' && PEOPLE.includes(value) ? undefined : 'invalid-option') },
}
// #endregion control

// #region rules
const rules: FlowCoreExtension['rules'] = [
  document => document.nodes.flatMap((node, index) => {
    if (node.type !== 'approve')
      return []
    const rejectable = document.edges.some(edge => edge.source.node === node.id && edge.data?.result === 'reject')
    return rejectable
      ? []
      : [{ code: 'leave.no-reject', path: ['nodes', index], target: { kind: 'node', id: node.id }, severity: 'warning' as const }]
  }),
]
// #endregion rules

// #region extension
export const leave: FlowCoreExtension = {
  id: '@example/leave',
  nodeTypes,
  controls,
  rules,
  issueText: issue => (issue.code === 'leave.no-reject' ? '审批节点要连出一条驳回' : undefined),
}
// #endregion extension

export const extensions = [leave]

export const schema: FlowDocument = {
  version: 1,
  nodes: [
    { id: 'apply', type: 'apply', x: 0, y: 64, width: 120, height: 40, label: '提交请假' },
    { id: 'leader', type: 'approve', x: 176, y: 60, width: 160, height: 48, label: '组长审批', data: { approver: '张三' } },
    { id: 'hr', type: 'notify', x: 400, y: 64, width: 140, height: 40, label: '抄送人事', data: { to: ['人事部'] } },
    { id: 'done', type: 'archive', x: 600, y: 64, width: 120, height: 40, label: '归档' },
    { id: 'back', type: 'archive', x: 400, y: 160, width: 120, height: 40, label: '退回' },
  ],
  edges: [
    { id: 'submit', source: { node: 'apply' }, target: { node: 'leader' } },
    { id: 'agree', source: { node: 'leader' }, target: { node: 'hr' }, label: '同意', data: { result: 'agree' } },
    { id: 'reject', source: { node: 'leader' }, target: { node: 'back' }, label: '驳回', data: { result: 'reject' } },
    { id: 'file', source: { node: 'hr' }, target: { node: 'done' } },
  ],
}
