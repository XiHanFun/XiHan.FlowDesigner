/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 冒烟页面：照文档站快速开始与设计器一页的接法，注册查看器与设计器、引入样式、切换语言，把同一份流程定义交给两者。

import type { FlowDocument } from '@xihan-flow/core'
import { createXihanWorkflow, xihanWorkflowZhCN } from '@xihan-flow/core/presets/xihan-workflow'
import { defineFlowDesigner } from '@xihan-flow/designer'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { zhCN } from '@xihan-ui/web-components/locale'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-flow/runtime/style.css'
import '@xihan-flow/designer/style.css'

setXhConfig(mergeXhConfig(zhCN, flowZhCN))
defineFlowViewer()
defineFlowDesigner()

const extensions = [createXihanWorkflow({ texts: xihanWorkflowZhCN })]
const schema: FlowDocument = {
  version: 1,
  data: { code: 'smoke', name: '冒烟' },
  nodes: [
    { id: 'start', type: 'Start', x: 0, y: 0, width: 120, height: 40, label: '开始' },
    { id: 'end', type: 'End', x: 200, y: 0, width: 120, height: 40, label: '结束', data: { properties: { Outcome: 'approved' } } },
  ],
  edges: [{ id: 'go', source: { node: 'start' }, target: { node: 'end' } }],
}

const viewer = document.createElement('xh-flow-viewer')
viewer.extensions = extensions
viewer.schema = schema
viewer.setNodeStatuses({ start: 'completed' })

const designer = document.createElement('xh-flow-designer')
designer.extensions = extensions
designer.paletteGroupLabels = xihanWorkflowZhCN.categories
designer.schema = schema
designer.addEventListener('schema-change', () => void designer.schema)

document.body.append(viewer, designer)
