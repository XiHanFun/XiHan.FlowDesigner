/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 与宿主集成：打开与保存流程（存成引擎定义）、离开前提醒未保存、显示实例的运行状态、服务端复核流程定义。

// #region save
import type { XihanWorkflowDefinition } from '@xihan-flow/core/presets/xihan-workflow'
import type { XhFlowDesigner } from '@xihan-flow/designer'
import type { FlowNodeStatus, XhFlowViewer } from '@xihan-flow/runtime'
import { readDocument, validateDocument } from '@xihan-flow/core'
import { createXihanWorkflow, fromWorkflowDefinition, toWorkflowDefinition } from '@xihan-flow/core/presets/xihan-workflow'

export async function openWorkflow(designer: XhFlowDesigner, code: string): Promise<void> {
  const url = `/api/workflows/${encodeURIComponent(code)}`
  const response = await fetch(url)
  designer.schema = fromWorkflowDefinition(await response.json() as XihanWorkflowDefinition)

  designer.addEventListener('save', async () => {
    if (designer.validate().some(issue => issue.severity === 'error'))
      return
    const saving = designer.schema
    const saved = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toWorkflowDefinition(saving)),
    })
    // 保存期间又改过的，不记为已保存
    if (saved.ok && designer.schema === saving)
      designer.markSaved()
  })
}
// #endregion save

// #region leave
export function guardUnsaved(designer: XhFlowDesigner): () => void {
  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (designer.dirty)
      event.preventDefault()
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  return () => window.removeEventListener('beforeunload', onBeforeUnload)
}
// #endregion leave

// #region status
/** 宿主接口返回的一条节点执行记录。 */
interface NodeRecord {
  readonly nodeId: string
  readonly status: FlowNodeStatus
}

export async function showInstance(viewer: XhFlowViewer, instanceId: string): Promise<void> {
  const response = await fetch(`/api/workflow-instances/${encodeURIComponent(instanceId)}/nodes`)
  const records = await response.json() as NodeRecord[]
  viewer.statuses = Object.fromEntries(records.map(record => [record.nodeId, record.status]))
  viewer.highlightNodes(records.map(record => record.nodeId))
}
// #endregion status

// #region server
/** 服务端收到流程定义时复核：读入不了或有错误级问题就拒收，返回问题码与路径。 */
export function reviewWorkflow(body: string): { valid: boolean, errors: string[] } {
  const read = readDocument(JSON.parse(body))
  if (!read.ok)
    return { valid: false, errors: read.issues.map(issue => `${issue.code} @ ${issue.path.join('.')}`) }
  const errors = validateDocument(read.document, { extensions: [createXihanWorkflow()] })
    .filter(issue => issue.severity === 'error')
    .map(issue => `${issue.code} @ ${issue.path.join('.')}`)
  return { valid: errors.length === 0, errors }
}
// #endregion server
