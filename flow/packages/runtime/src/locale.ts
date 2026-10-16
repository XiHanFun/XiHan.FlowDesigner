/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程产品的中文文案，查看器与设计器共用：与 UI 的语言包一起交给 mergeXhConfig，再经 setXhConfig 或 <xh-config> 生效。

import type { XhConfig } from '@xihan-ui/web-components'
import type {} from './translations'

/** 流程查看器与设计器的中文文案。 */
export const flowZhCN: XhConfig = {
  translations: {
    'xh-flow-viewer': { label: '流程图' },
    'xh-flow-designer': {
      label: '流程设计器',
      toolbar: '设计器工具',
      undo: '撤销',
      redo: '重做',
      delete: '删除',
      duplicate: '创建副本',
      alignLeft: '左对齐',
      alignCenter: '水平居中',
      alignRight: '右对齐',
      alignTop: '顶端对齐',
      alignMiddle: '垂直居中',
      alignBottom: '底端对齐',
      distributeHorizontal: '水平等距',
      distributeVertical: '垂直等距',
      autoLayout: '自动布局',
      zoomIn: '放大',
      zoomOut: '缩小',
      zoomToFit: '适配',
      zoomToActual: '100%',
      palette: '节点',
      paletteUncategorized: '其他',
    },
  },
}
