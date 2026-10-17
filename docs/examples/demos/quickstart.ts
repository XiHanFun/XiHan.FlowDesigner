/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 快速开始：把费用审批交给 <xh-flow-viewer> 显示，点按钮逐步标出节点的运行状态。

// #region setup
import type { FlowNodeStatus } from '@xihan-flow/runtime'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { extensions, schema } from '../schemas/approval'
import '@xihan-ui/styles/index.css'
import '@xihan-flow/runtime/style.css'

defineFlowViewer()
// #endregion setup

/** 每一步要标出的运行状态：节点 id → 状态。 */
const steps: readonly Readonly<Record<string, FlowNodeStatus>>[] = [
  { start: 'completed', dept: 'running' },
  { dept: 'completed', amount: 'completed', gm: 'running' },
  { gm: 'completed', approved: 'completed' },
]

export function mount(host: HTMLElement): () => void {
  // #region render
  const viewer = document.createElement('xh-flow-viewer')
  viewer.extensions = extensions
  viewer.schema = schema
  // #endregion render

  // #region status
  let step = 0
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = '下一步'
  button.addEventListener('click', () => {
    if (step === steps.length) {
      step = 0
      viewer.statuses = {}
      return
    }
    viewer.setNodeStatuses(steps[step]!)
    step += 1
  })
  // #endregion status

  host.append(button, viewer)
  return () => host.replaceChildren()
}
