/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 费用审批：提交申请 → 部门经理审批 → 金额判断 → 总经理审批或直接通过，部门经理可以驳回。
// 节点类型来自 XiHan 工作流引擎的节点预设（中文文案）。

import type { FlowDocument } from '@xihan-flow/core'
import { createXihanWorkflow, xihanWorkflowZhCN } from '@xihan-flow/core/presets/xihan-workflow'

// #region extensions
/** 节点类型、属性与规则：XiHan 工作流引擎的节点预设，文案用中文。 */
export const workflow = createXihanWorkflow({ texts: xihanWorkflowZhCN })

export const extensions = [workflow]
// #endregion extensions

// #region schema
export const schema: FlowDocument = {
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
// #endregion schema
