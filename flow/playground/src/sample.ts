/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 演示用的节点类型与审批流：开始 → 部门审批 → 金额分支 → 总经理审批 / 直接通过 → 结束，部门审批可驳回。
// 节点类型与表达式这种编辑方式写成一个扩展，查看器与设计器共用。

import type { FlowCoreExtension, FlowDocument } from '@xihan-flow/core'

export const approvalTypes: FlowCoreExtension = {
  id: '@xihan-flow/playground',
  controls: { expression: {} },
  nodeTypes: [
    { type: 'Start', label: '开始', category: 'control', size: { width: 120, height: 40 }, ports: 'out', entry: true, minCount: 1, maxCount: 1 },
    {
      type: 'UserTask',
      label: '审批',
      category: 'human',
      size: { width: 160, height: 48 },
      ports: 'both',
      defaults: { data: { properties: { CompletionPolicy: 'Any' } } },
      properties: [
        { path: ['label'], control: { kind: 'text' }, group: 'basic', label: '名称', required: true },
        { path: ['data', 'properties', 'Title'], control: { kind: 'text', placeholder: '单据 {{billNo}} 审批' }, group: 'basic', label: '待办标题' },
        { path: ['data', 'properties', 'Assignees'], control: { kind: 'tags' }, group: 'participants', label: '受理人', required: true },
        {
          path: ['data', 'properties', 'CompletionPolicy'],
          control: { kind: 'select', options: [{ value: 'Any', label: '任一人通过' }, { value: 'All', label: '全部通过' }] },
          group: 'participants',
          label: '通过规则',
        },
        { path: ['data', 'timeoutSeconds'], control: { kind: 'number', integer: true, min: 0, unit: 's' }, group: 'execution', label: '超时（秒）' },
      ],
    },
    {
      type: 'Decision',
      label: '条件分支',
      category: 'control',
      size: { width: 140, height: 48 },
      ports: 'both',
      properties: [
        { path: ['label'], control: { kind: 'text' }, label: '名称', required: true },
        {
          path: ['data', 'properties', 'Expression'],
          control: { kind: 'expression' },
          label: '分支条件',
          meta: { description: '宿主自定义的编辑器，例如 amount > 10000' },
        },
        { path: ['data', 'properties', 'Settings'], control: { kind: 'json' }, label: '高级设置' },
      ],
    },
    {
      type: 'End',
      label: '结束',
      category: 'control',
      size: { width: 120, height: 40 },
      ports: 'in',
      terminal: true,
      properties: [
        {
          path: ['data', 'properties', 'Outcome'],
          control: { kind: 'select', options: [{ value: 'approved', label: '通过' }, { value: 'rejected', label: '驳回' }] },
          label: '审批结果',
        },
      ],
    },
  ],
}

export function approvalFlow(): FlowDocument {
  return {
    version: 1,
    nodes: [
      { id: 'start', type: 'Start', x: 0, y: 104, width: 120, height: 40, label: '提交申请' },
      { id: 'dept', type: 'UserTask', x: 176, y: 100, width: 160, height: 48, label: '部门经理审批', data: { properties: { Assignees: ['部门经理'], CompletionPolicy: 'Any' } } },
      { id: 'amount', type: 'Decision', x: 400, y: 100, width: 140, height: 48, label: '金额判断' },
      { id: 'gm', type: 'UserTask', x: 608, y: 16, width: 160, height: 48, label: '总经理审批', data: { properties: { Assignees: ['总经理'], CompletionPolicy: 'Any' } } },
      { id: 'approved', type: 'End', x: 840, y: 104, width: 120, height: 40, label: '通过', data: { properties: { Outcome: 'approved' } } },
      { id: 'rejected', type: 'End', x: 400, y: 232, width: 120, height: 40, label: '驳回', data: { properties: { Outcome: 'rejected' } } },
    ],
    edges: [
      { id: 'submit', source: { node: 'start' }, target: { node: 'dept' } },
      { id: 'agree', source: { node: 'dept' }, target: { node: 'amount' }, label: '同意' },
      { id: 'reject', source: { node: 'dept' }, target: { node: 'rejected' }, label: '驳回' },
      { id: 'large', source: { node: 'amount' }, target: { node: 'gm' }, label: '金额 > 1 万' },
      { id: 'small', source: { node: 'amount' }, target: { node: 'approved' }, label: '其余', style: { dashed: true } },
      { id: 'gm-agree', source: { node: 'gm' }, target: { node: 'approved' }, label: '同意' },
    ],
  }
}

/** 模拟运行的各步：节点 id → 运行状态。 */
export const runSteps: readonly Readonly<Record<string, string | null>>[] = [
  { start: null, dept: null, amount: null, gm: null, approved: null, rejected: null },
  { start: 'completed', dept: 'running' },
  { dept: 'completed', amount: 'completed', gm: 'running' },
  { gm: 'completed', approved: 'completed' },
]
