/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 与引擎定义互转：费用审批换成 XiHan 工作流引擎的定义 JSON；去掉坐标后读回，节点按连线自左向右重新排开。

import type { XihanWorkflowDefinition } from '@xihan-flow/core/presets/xihan-workflow'
import { fromWorkflowDefinition, toWorkflowDefinition } from '@xihan-flow/core/presets/xihan-workflow'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { extensions, schema } from '../schemas/approval'

defineFlowViewer()

function button(text: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = text
  element.addEventListener('click', onClick)
  return element
}

export function mount(host: HTMLElement): () => void {
  // #region to
  const definition: XihanWorkflowDefinition = toWorkflowDefinition(schema)
  const json = JSON.stringify(definition, null, 2)
  // #endregion to

  const output = document.createElement('pre')
  output.textContent = json
  const viewer = document.createElement('xh-flow-viewer')
  viewer.extensions = extensions

  // #region from
  const readBack = button('去掉坐标后读回', () => {
    const saved = JSON.parse(json) as XihanWorkflowDefinition
    const { designerLayout: _, ...extraProperties } = saved.extraProperties ?? {}
    viewer.schema = fromWorkflowDefinition({ ...saved, extraProperties })
  })
  const original = button('按保存的坐标读回', () => {
    viewer.schema = fromWorkflowDefinition(JSON.parse(json) as XihanWorkflowDefinition)
  })
  // #endregion from

  original.click()
  host.append(output, readBack, original, viewer)
  return () => host.replaceChildren()
}
