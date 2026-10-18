/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 冒烟的 Node 侧：core 不碰 DOM，在 Node 里读入一份流程定义，按 XiHan 工作流预设校验，没有 error 级问题即通过。
import { readDocument, validateDocument } from '@xihan-flow/core'
import { createXihanWorkflow } from '@xihan-flow/core/presets/xihan-workflow'

const read = readDocument({
  version: 1,
  data: { code: 'smoke', name: '冒烟' },
  nodes: [
    { id: 'start', type: 'Start', x: 0, y: 0, width: 120, height: 40 },
    { id: 'end', type: 'End', x: 200, y: 0, width: 120, height: 40, data: { properties: { Outcome: 'approved' } } },
  ],
  edges: [{ id: 'go', source: { node: 'start' }, target: { node: 'end' } }],
})
if (!read.ok) {
  console.error('[smoke] ✗ Node 里读入流程定义失败：', read.issues)
  process.exit(1)
}
const errors = validateDocument(read.document, { extensions: [createXihanWorkflow()] }).filter(issue => issue.severity === 'error')
if (errors.length > 0) {
  console.error('[smoke] ✗ Node 里建的流程定义校验不通过：', errors)
  process.exit(1)
}
console.log('[smoke] Node 侧：@xihan-flow/core 导入、读入流程定义与校验正常')
