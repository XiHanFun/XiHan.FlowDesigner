/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 演示用的审批流：开始 → 部门审批 → 金额分支 → 总经理审批 / 直接通过 → 结束，部门审批可驳回。
// 节点类型用 XiHan 工作流引擎的预设（中文文案），查看器与设计器共用。

import type { FlowDocument } from '@xihan-flow/core'
import { createXihanWorkflow, xihanWorkflowZhCN } from '@xihan-flow/core/presets/xihan-workflow'

export const workflow = createXihanWorkflow({ texts: xihanWorkflowZhCN })

export function approvalFlow(): FlowDocument {
  return {
    version: 1,
    data: { code: 'expense', name: '费用审批' },
    nodes: [
      { id: 'start', type: 'Start', x: 0, y: 104, width: 120, height: 40, label: '提交申请' },
      { id: 'dept', type: 'UserTask', x: 176, y: 100, width: 160, height: 48, label: '部门经理审批', data: { properties: { Assignees: ['部门经理'], CompletionPolicy: 'Any' } } },
      { id: 'amount', type: 'Decision', x: 400, y: 100, width: 160, height: 48, label: '金额判断' },
      { id: 'gm', type: 'UserTask', x: 624, y: 16, width: 160, height: 48, label: '总经理审批', data: { properties: { Assignees: ['总经理'], CompletionPolicy: 'Any' } } },
      { id: 'approved', type: 'End', x: 856, y: 104, width: 120, height: 40, label: '通过', data: { properties: { Outcome: 'approved' } } },
      { id: 'rejected', type: 'End', x: 400, y: 232, width: 120, height: 40, label: '驳回', data: { properties: { Outcome: 'rejected' } } },
    ],
    edges: [
      { id: 'submit', source: { node: 'start' }, target: { node: 'dept' } },
      { id: 'agree', source: { node: 'dept' }, target: { node: 'amount' }, label: '同意', data: { condition: 'outcome == "approved"' } },
      { id: 'reject', source: { node: 'dept' }, target: { node: 'rejected' }, label: '驳回', data: { condition: 'outcome == "rejected"' } },
      { id: 'large', source: { node: 'amount' }, target: { node: 'gm' }, label: '金额 > 1 万', data: { condition: 'amount > 10000', priority: 0 } },
      { id: 'small', source: { node: 'amount' }, target: { node: 'approved' }, label: '其余', style: { dashed: true }, data: { isDefault: true, priority: 1 } },
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
