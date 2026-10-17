/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 开发预览页：注册 UI 元素与流程的查看器、设计器，装上示例审批流并接好工具栏。

import type { FlowDesignerEventMap } from '@xihan-flow/designer'
import { defineFlowDesigner } from '@xihan-flow/designer'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { zhCN } from '@xihan-ui/web-components/locale'
import { expressionEditor } from './expression-editor'
import { approvalFlow, approvalTypes, runSteps } from './sample'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-flow/runtime/style.css'
import '@xihan-flow/designer/style.css'

defineXhElements()
defineFlowViewer()
defineFlowDesigner()

function toolbar(label: string, run: (action: string) => void): void {
  const root = document.querySelector(`[aria-label="${label}"]`)!
  root.addEventListener('click', (event) => {
    const item = (event.target as Element).closest<HTMLButtonElement>('button[value]')
    if (item && !item.disabled)
      run(item.value)
  })
}

const viewer = document.querySelector('xh-flow-viewer')!
viewer.extensions = [approvalTypes]
viewer.schema = approvalFlow()
let step = 0
let highlighted = false

toolbar('查看器操作', (action) => {
  switch (action) {
    case 'fit':
      viewer.zoomToFit()
      break
    case 'zoom-in':
      viewer.zoomIn()
      break
    case 'zoom-out':
      viewer.zoomOut()
      break
    case 'actual':
      viewer.zoomToActual()
      break
    case 'run':
      step = (step + 1) % runSteps.length
      if (step === 0)
        viewer.statuses = {}
      else
        viewer.setNodeStatuses(runSteps[step]!)
      break
    case 'highlight':
      highlighted = !highlighted
      if (highlighted)
        viewer.highlightNodes(['gm', 'approved'])
      else
        viewer.clearHighlights()
      break
    case 'reset':
      step = 0
      highlighted = false
      viewer.statuses = {}
      viewer.clearHighlights()
      break
  }
})

const designer = document.querySelector('xh-flow-designer')!
const log = document.querySelector<HTMLElement>('#log')!
designer.extensions = [approvalTypes, { id: '@xihan-flow/playground/editors', editors: { byControl: { expression: expressionEditor } } }]
designer.paletteGroupOrder = ['human', 'control']
designer.paletteGroupLabels = { human: '人工处理', control: '流程控制' }
designer.propertyGroupOrder = ['basic', 'participants', 'execution']
designer.propertyGroupLabels = { basic: '基本', participants: '参与人', execution: '执行' }
designer.schema = approvalFlow()

function write(line: string): void {
  log.textContent = `${line}\n${log.textContent ?? ''}`.slice(0, 4000)
}

function onDesigner<K extends keyof FlowDesignerEventMap>(type: K, listener: (event: FlowDesignerEventMap[K]) => void): void {
  designer.addEventListener(type, event => listener(event as FlowDesignerEventMap[K]))
}

onDesigner('schema-change', (event) => {
  const { kind, operations } = event.detail
  write(`schema-change ${kind} ${operations.map(operation => operation.type).join(', ')}`)
})
onDesigner('selection-change', (event) => {
  write(`selection-change ${JSON.stringify(event.detail)}`)
})
onDesigner('connect-reject', (event) => {
  write(`connect-reject ${event.detail.problems.map(problem => problem.code).join(', ')}`)
})
onDesigner('issues-change', (event) => {
  write(`issues-change ${event.detail.issues.map(issue => issue.code).join(', ') || '无问题'}`)
})
document.querySelector('#zh')!.addEventListener('checked-change', (event) => {
  setXhConfig((event as CustomEvent<{ checked: boolean }>).detail.checked ? mergeXhConfig(zhCN, flowZhCN) : {})
})
