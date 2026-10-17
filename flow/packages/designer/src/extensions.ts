/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器层的扩展：在运行时层之上加属性编辑器、命令、面板与装上时的回调；内置命令也写成一个扩展。

import type { FlowDocument, FlowRuleContext } from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowRuntimeExtension, FlowRuntimeModel } from '@xihan-flow/runtime'
import type { DesignerCommand } from '@xihan-ui/designer-kit'
import type { PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { DesignerCommandTable, DesignerShellExtension } from '@xihan-ui/designer-shell'
import type { XhFlowDesigner } from './flow-designer'
import type { FlowPropertyEditor } from './panels/properties'
import { createFlowRuntimeModel } from '@xihan-flow/runtime'
import { extensionCommands, extensionEditors } from '@xihan-ui/designer-kit'

/** 命令、面板与扩展装上时拿到的上下文。 */
export interface FlowDesignerContext {
  readonly designer: XhFlowDesigner
  /** 此刻生效的设计器文案。 */
  readonly translations: FlowDesignerTranslations
}

/** 设计器的命令。 */
export type FlowDesignerCommand = DesignerCommand<FlowDesignerContext>

/** 流程设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、导入导出与 setup。 */
export interface FlowDesignerExtension extends FlowRuntimeExtension, DesignerShellExtension<FlowDesignerContext, FlowPropertyEditor, FlowDocument, FlowRuleContext> {}

/** 取值是字符串的文案键。 */
type TextKey = { [K in keyof FlowDesignerTranslations]: FlowDesignerTranslations[K] extends string ? K : never }[keyof FlowDesignerTranslations]

const text = (key: TextKey) => (context: FlowDesignerContext): string => context.translations[key]
const editable = (test: (designer: XhFlowDesigner) => boolean) => ({ designer }: FlowDesignerContext): boolean => !designer.readonly && test(designer)
const selectedNodes = (designer: XhFlowDesigner): number => designer.getSelection().nodes.length

/** 选中的连线里有带手动拐点的。 */
function selectedVertices(designer: XhFlowDesigner): boolean {
  const selected = new Set(designer.getSelection().edges)
  return designer.schema.edges.some(edge => selected.has(edge.id) && edge.vertices !== undefined)
}

/** 内置命令：撤销重做、剪贴板、选择、对齐分布、布局与缩放。 */
const BUILTIN_COMMANDS: readonly FlowDesignerCommand[] = [
  { id: 'undo', label: text('undo'), shortcut: ['Mod', 'Z'], enabled: editable(d => d.canUndo), run: ({ designer }) => designer.undo() },
  { id: 'redo', label: text('redo'), shortcut: ['Mod', 'Shift', 'Z'], enabled: editable(d => d.canRedo), run: ({ designer }) => designer.redo() },
  { id: 'copy', label: text('copy'), enabled: ({ designer }) => selectedNodes(designer) > 0, run: ({ designer }) => designer.copy() },
  { id: 'cut', label: text('cut'), enabled: editable(d => selectedNodes(d) > 0), run: ({ designer }) => designer.cut() },
  { id: 'paste', label: text('paste'), enabled: editable(d => d.canPaste), run: ({ designer }) => designer.paste() },
  {
    id: 'delete',
    label: text('delete'),
    shortcut: ['Delete'],
    enabled: editable(d => selectedNodes(d) + d.getSelection().edges.length > 0),
    run: ({ designer }) => designer.deleteSelection(),
  },
  { id: 'duplicate', label: text('duplicate'), shortcut: ['Mod', 'D'], enabled: editable(d => selectedNodes(d) > 0), run: ({ designer }) => designer.duplicate() },
  {
    id: 'select-all',
    label: text('selectAll'),
    shortcut: ['Mod', 'A'],
    enabled: ({ designer }) => designer.schema.nodes.length > 0,
    run: ({ designer }) => designer.select({ nodes: designer.schema.nodes.map(node => node.id), edges: designer.schema.edges.map(edge => edge.id) }),
  },
  { id: 'align-left', label: text('alignLeft'), enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('left') },
  { id: 'align-center', label: text('alignCenter'), enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('center-vertical') },
  { id: 'align-right', label: text('alignRight'), enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('right') },
  { id: 'align-top', label: text('alignTop'), enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('top') },
  { id: 'align-middle', label: text('alignMiddle'), enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('center-horizontal') },
  { id: 'align-bottom', label: text('alignBottom'), enabled: editable(d => selectedNodes(d) >= 2), run: ({ designer }) => designer.align('bottom') },
  { id: 'distribute-horizontal', label: text('distributeHorizontal'), enabled: editable(d => selectedNodes(d) >= 3), run: ({ designer }) => designer.distribute('horizontal') },
  { id: 'distribute-vertical', label: text('distributeVertical'), enabled: editable(d => selectedNodes(d) >= 3), run: ({ designer }) => designer.distribute('vertical') },
  { id: 'auto-layout', label: text('autoLayout'), enabled: editable(d => d.schema.nodes.length > 0), run: ({ designer }) => designer.autoLayout() },
  {
    id: 'clear-vertices',
    label: text('clearVertices'),
    enabled: editable(selectedVertices),
    run: ({ designer }) => {
      const selected = new Set(designer.getSelection().edges)
      designer.execute(designer.schema.edges
        .filter(edge => selected.has(edge.id) && edge.vertices !== undefined)
        .map(edge => ({ type: 'updateEdge', id: edge.id, patch: { vertices: null } })))
    },
  },
  { id: 'zoom-out', label: text('zoomOut'), shortcut: ['-'], run: ({ designer }) => designer.zoomOut() },
  { id: 'zoom-in', label: text('zoomIn'), shortcut: ['+'], run: ({ designer }) => designer.zoomIn() },
  { id: 'zoom-to-fit', label: text('zoomToFit'), shortcut: ['0'], run: ({ designer }) => designer.zoomToFit() },
  { id: 'zoom-to-actual', label: text('zoomToActual'), run: ({ designer }) => designer.zoomToActual() },
]

/** 设计器的内置扩展：内置命令。节点类型、连线属性等 core 层的内置部分在 FLOW_CORE_EXTENSION 里。 */
export const FLOW_DESIGNER_EXTENSION: FlowDesignerExtension = {
  id: '@xihan-flow/designer',
  commands: BUILTIN_COMMANDS,
}

/** 工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。 */
export const FLOW_TOOLBAR_LAYOUT: readonly (readonly string[])[] = [
  ['undo', 'redo'],
  ['delete', 'duplicate'],
  ['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'distribute-horizontal', 'distribute-vertical', 'auto-layout'],
  ['zoom-out', 'zoom-in', 'zoom-to-fit', 'zoom-to-actual'],
]

/** 右键菜单落在哪类对象上。 */
export type FlowMenuSubject = 'node' | 'edge' | 'blank'

/** 右键菜单的缺省排列：节点菜单在选中两个以上时加对齐，三个以上时加分布。 */
export function flowMenuLayout(subject: FlowMenuSubject, selectedNodes: number): string[][] {
  if (subject === 'edge')
    return [['delete', 'clear-vertices']]
  if (subject === 'blank')
    return [['paste', 'select-all'], ['auto-layout', 'zoom-to-fit']]
  const groups = [['duplicate', 'copy', 'cut', 'delete']]
  if (selectedNodes >= 2)
    groups.push(['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom'])
  if (selectedNodes >= 3)
    groups.at(-1)!.push('distribute-horizontal', 'distribute-vertical')
  return groups
}

/** 一组设计器扩展合出的东西：交给 core 函数的列表、运行时模型、命令表与属性编辑器表。 */
export interface FlowDesignerModel {
  /** 设计器内置扩展在前、传入的在后；校验与编辑器都拿这一份。 */
  readonly list: readonly FlowDesignerExtension[]
  /** 再加上 core 层内置扩展的全部扩展，面板与命令按它的顺序。 */
  readonly extensions: readonly FlowDesignerExtension[]
  readonly runtime: FlowRuntimeModel
  readonly commands: DesignerCommandTable<FlowDesignerContext>
  readonly editors: PropertyEditorTable<FlowPropertyEditor>
}

/** 合出设计器用的模型；任何一处重名都抛 DesignerExtensionError。 */
export function createFlowDesignerModel(extensions: readonly FlowDesignerExtension[]): FlowDesignerModel {
  const list = [FLOW_DESIGNER_EXTENSION, ...extensions]
  const runtime = createFlowRuntimeModel(list)
  const all = runtime.extensions as readonly FlowDesignerExtension[]
  return { list, extensions: all, runtime, commands: extensionCommands(all), editors: extensionEditors<FlowPropertyEditor>(undefined, all) }
}
