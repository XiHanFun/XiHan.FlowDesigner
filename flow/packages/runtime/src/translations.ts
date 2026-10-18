/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程产品各元素的文案键：查看器与设计器的文案类型集中在这里，并补进 UI 的 XhTranslationOverrides。

import type { FlowIssue } from '@xihan-flow/core'

/** 查看器的文案。 */
export interface FlowViewerTranslations {
  /** 视口区域的可访问名。 */
  readonly label: string
}

/** 查看器的英文文案，也是不配语言包时的缺省。 */
export const DEFAULT_FLOW_VIEWER_TRANSLATIONS: FlowViewerTranslations = { label: 'Flow diagram' }

/** 设计器的文案。 */
export interface FlowDesignerTranslations {
  /** 画布区域的可访问名。 */
  readonly label: string
  /** 工具栏的可访问名。 */
  readonly toolbar: string
  /** 选一个文件交给导入器。 */
  readonly openFile: string
  readonly undo: string
  readonly redo: string
  readonly delete: string
  readonly duplicate: string
  readonly copy: string
  readonly cut: string
  readonly paste: string
  readonly selectAll: string
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
  /** 去掉连线的手动拐点，交回自动路由。 */
  readonly clearVertices: string
  readonly zoomIn: string
  readonly zoomOut: string
  readonly zoomToFit: string
  readonly zoomToActual: string
  /** 导出成 PNG 图片。 */
  readonly exportPng: string
  /** 导出成 SVG 图片。 */
  readonly exportSvg: string
  /** 内置图片导出器的名称。 */
  readonly exportImage: string
  /** 物料面板的标题。 */
  readonly palette: string
  /** 没有类别的节点类型所在分组的标题。 */
  readonly paletteUncategorized: string
  /** 没有选中时属性面板里的提示。 */
  readonly propertiesEmpty: string
  /** 选中多个对象时属性面板标题下的一行。 */
  readonly propertiesMultiple: (count: number) => string
  /** 属性面板里连线的类型名。 */
  readonly edge: string
  /** 属性描述没有给 label 时的标签，key 是 formatJsonPath 写出的属性路径。 */
  readonly propertyLabel: (key: string) => string
  /** 问题的说明文字。 */
  readonly issue: (issue: FlowIssue, names: FlowIssueNames) => string
  /** 落在某个属性上的问题：属性名与问题说明拼在一起。 */
  readonly propertyIssue: (property: string, message: string) => string
  /** 没有问题时问题列表里的提示。 */
  readonly issuesEmpty: string
  /** 不落在节点或连线上的问题（如节点个数）所属的对象名。 */
  readonly flow: string
}

/** 拼问题说明时用到的名称。 */
export interface FlowIssueNames {
  /** 节点类型的显示名。 */
  readonly nodeType: (type: string) => string
}

declare module '@xihan-ui/web-components' {
  interface XhTranslationOverrides {
    'xh-flow-viewer'?: Partial<FlowViewerTranslations>
    'xh-flow-designer'?: Partial<FlowDesignerTranslations>
  }
}
