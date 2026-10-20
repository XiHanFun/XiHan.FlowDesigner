/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程产品各元素的文案键：查看器与设计器的文案类型集中在这里，并补进 UI 的 XhTranslationOverrides。

import type { FlowIssue } from '@xihan-flow/core'
import type { LayeredDirection } from '@xihan-ui/viz/graph'

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
  /** 选一个文件交给导入器。 */
  readonly openFile: string
  readonly autoLayout: string
  /** 去掉连线的手动拐点，交回自动路由。 */
  readonly clearVertices: string
  /** 导出成 PNG 图片。 */
  readonly exportPng: string
  /** 导出成 SVG 图片。 */
  readonly exportSvg: string
  /** 内置图片导出器的名称。 */
  readonly exportImage: string
  /** 物料面板的标题。 */
  readonly palette: string
  /** 小地图的名字：面板菜单与设计器的面板命令用。 */
  readonly minimap: string
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
  /** 物料面板头的帮助。 */
  readonly paletteHelp: string
  /** 属性面板头的帮助。 */
  readonly propertiesHelp: string
  /** 问题列表面板头的帮助。 */
  readonly issuesHelp: string
  /** 设置里设计器自己那一页（画布）的名字。 */
  readonly settingsCanvas: string
  /** 设置：自动布局方向的标签。 */
  readonly settingsLayoutDirection: string
  /** 设置：自动布局方向的说明。 */
  readonly settingsLayoutDirectionHint: string
  /** 设置：自动布局各个方向的名字。 */
  readonly settingsLayoutDirections: Readonly<Record<LayeredDirection, string>>
  /** 设置：同层节点间距的标签。 */
  readonly settingsNodeGap: string
  /** 设置：同层节点间距的说明。 */
  readonly settingsNodeGapHint: string
  /** 设置：层间距的标签。 */
  readonly settingsLayerGap: string
  /** 设置：层间距的说明。 */
  readonly settingsLayerGapHint: string
  /** 设置：吸附对齐开关的标签。 */
  readonly settingsSnap: string
  /** 设置：吸附对齐开关的说明。 */
  readonly settingsSnapHint: string
  /** 状态栏：缩放一项的标签。 */
  readonly statusZoom: string
  /** 状态栏：选中多个对象时左边写的话。 */
  readonly statusSelected: (count: number) => string
  /** 状态栏：什么都没选中时左边写流程里有多少节点与连线。 */
  readonly statusDocument: (nodes: number, edges: number) => string
  /** 状态栏：选中一个节点时写它的位置与尺寸（世界坐标，取整）。 */
  readonly statusGeometry: (x: number, y: number, width: number, height: number) => string
  /** 选中节点时浮在选中框上的选中工具条的可访问名。 */
  readonly selectionToolbar: string
  /** 内置命令：对齐与分布菜单，点开列出六种对齐与两种分布。 */
  readonly alignMenu: string
  /** 不落在节点或连线上的问题（如节点个数）所属的对象名。 */
  readonly flow: string
  /** 启动变量表的列名。 */
  readonly startVariableColumns: Readonly<Record<FlowStartVariableColumn, string>>
  /** 启动变量表的新增按钮。 */
  readonly startVariableAdd: string
  /** 启动变量表里一格的可访问名：第几个变量（从 1 起）、哪一列。 */
  readonly startVariableCell: (row: number, column: string) => string
  /** 新手引导里流程自己的几步：标题与说明。 */
  readonly tourSteps: Readonly<Record<FlowTourStepKey, FlowTourStepTranslations>>
  /** 设置对话框「帮助」页的几段操作说明。 */
  readonly helpNotes: readonly string[]
  /** 快捷键页：方向键一行按流程的做法改写的说明。 */
  readonly shortcutNudge: string
  /** 快捷键页：Esc 一行按流程的做法改写的说明。 */
  readonly shortcutCancel: string
  /** 快捷键页：Shift + F10 与菜单键一行的说明。 */
  readonly shortcutContextMenu: string
  /** 流程结构面板（页面结构零件）的标题、帮助、搜索框与空状态，压在零件文案之上。 */
  readonly outline: FlowOutlineTranslations
  /** 撤销历史里一步的说明。 */
  readonly history: FlowHistoryTranslations
}

/** 流程结构面板的几处文案。 */
export interface FlowOutlineTranslations {
  readonly title: string
  readonly help: string
  readonly search: string
  readonly empty: string
}

/** 撤销历史里一步的说明：单个节点写「种类 名称」（见 node，没有名称时名称是 id），几个节点写个数。 */
export interface FlowHistoryTranslations {
  /** 说明里一个节点的写法：kind 是节点类型的显示名，name 是节点的名称或 id。 */
  readonly node: (kind: string, name: string) => string
  readonly addNode: (label: string) => string
  readonly addNodes: (count: number) => string
  readonly removeNode: (label: string) => string
  readonly removeNodes: (count: number) => string
  readonly moveNode: (label: string) => string
  readonly moveNodes: (count: number) => string
  readonly resizeNode: (label: string) => string
  readonly resizeNodes: (count: number) => string
  readonly editNode: (label: string) => string
  readonly editNodes: (count: number) => string
  /** 按住 Alt 拖动复制、创建副本。 */
  readonly copyNode: (label: string) => string
  readonly copyNodes: (count: number) => string
  readonly addEdge: string
  readonly addEdges: (count: number) => string
  readonly removeEdge: string
  readonly removeEdges: (count: number) => string
  /** 把连线的一端改连到别处。 */
  readonly reconnectEdge: string
  /** 拖拐点、加拐点或去掉拐点。 */
  readonly editRoute: string
  readonly editEdge: string
  readonly editEdges: (count: number) => string
  /** 在属性面板里改了一项；name 是属性名。 */
  readonly editProperty: (name: string) => string
  /** 改了流程定义本身的属性。 */
  readonly editDocument: string
  /** 在 JSON 编辑框里整份换上。 */
  readonly editJson: string
}

/** 新手引导里流程自己的几步：连线与自动布局。 */
export type FlowTourStepKey = 'connect' | 'autoLayout'

/** 新手引导一步的文案。 */
export interface FlowTourStepTranslations {
  readonly title: string
  readonly description: string
}

/** 启动变量表的列：变量名、必填、缺省值、说明。 */
export type FlowStartVariableColumn = 'name' | 'required' | 'defaultValue' | 'description'

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
