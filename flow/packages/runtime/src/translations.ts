/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程产品各元素的文案键：查看器与设计器的文案类型集中在这里，并补进 UI 的 XhTranslationOverrides。

/** 查看器的文案。 */
export interface FlowViewerTranslations {
  /** 视口区域的可访问名。 */
  readonly label: string
}

/** 设计器的文案。 */
export interface FlowDesignerTranslations {
  /** 画布区域的可访问名。 */
  readonly label: string
  /** 工具栏的可访问名。 */
  readonly toolbar: string
  readonly undo: string
  readonly redo: string
  readonly delete: string
  readonly duplicate: string
  readonly alignLeft: string
  /** 各自的中心落到同一条竖直中线上。 */
  readonly alignCenter: string
  readonly alignRight: string
  readonly alignTop: string
  /** 各自的中心落到同一条水平中线上。 */
  readonly alignMiddle: string
  readonly alignBottom: string
  readonly distributeHorizontal: string
  readonly distributeVertical: string
  readonly autoLayout: string
  readonly zoomIn: string
  readonly zoomOut: string
  readonly zoomToFit: string
  readonly zoomToActual: string
  /** 物料面板的标题。 */
  readonly palette: string
  /** 没有类别的节点类型所在分组的标题。 */
  readonly paletteUncategorized: string
}

declare module '@xihan-ui/web-components' {
  interface XhTranslationOverrides {
    'xh-flow-viewer'?: Partial<FlowViewerTranslations>
    'xh-flow-designer'?: Partial<FlowDesignerTranslations>
  }
}
