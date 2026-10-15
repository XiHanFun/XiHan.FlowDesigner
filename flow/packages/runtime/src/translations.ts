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
}

declare module '@xihan-ui/web-components' {
  interface XhTranslationOverrides {
    'xh-flow-viewer'?: Partial<FlowViewerTranslations>
    'xh-flow-designer'?: Partial<FlowDesignerTranslations>
  }
}
