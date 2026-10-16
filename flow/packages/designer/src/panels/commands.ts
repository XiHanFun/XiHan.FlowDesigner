/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 工具栏与右键菜单共用的命令表：每条命令的文案键、执行与可用条件。

import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { XhFlowDesigner } from '../flow-designer'

/** 工具栏与右键菜单的命令。 */
export type FlowCommand
  = | 'undo'
    | 'redo'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'delete'
    | 'duplicate'
    | 'select-all'
    | 'align-left'
    | 'align-center'
    | 'align-right'
    | 'align-top'
    | 'align-middle'
    | 'align-bottom'
    | 'distribute-horizontal'
    | 'distribute-vertical'
    | 'auto-layout'
    | 'clear-vertices'
    | 'zoom-out'
    | 'zoom-in'
    | 'zoom-to-fit'
    | 'zoom-to-actual'

/** 取值是字符串的文案键。 */
export type TextKey = { [K in keyof FlowDesignerTranslations]: FlowDesignerTranslations[K] extends string ? K : never }[keyof FlowDesignerTranslations]

/** 判断命令能否执行时看的设计器状态。 */
export interface CommandState {
  readonly readonly: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly canPaste: boolean
  readonly nodes: number
  readonly selectedNodes: number
  readonly selectedEdges: number
  /** 选中的连线里有带手动拐点的。 */
  readonly selectedVertices: boolean
}

export interface CommandSpec {
  readonly label: TextKey
  readonly run: (designer: XhFlowDesigner) => void
  readonly enabled: (state: CommandState) => boolean
}

const editable = (test: (state: CommandState) => boolean) => (state: CommandState): boolean => !state.readonly && test(state)
const always = (): boolean => true

/** 全部命令。 */
export const COMMANDS: Readonly<Record<FlowCommand, CommandSpec>> = {
  'undo': { label: 'undo', run: d => d.undo(), enabled: editable(s => s.canUndo) },
  'redo': { label: 'redo', run: d => d.redo(), enabled: editable(s => s.canRedo) },
  'copy': { label: 'copy', run: d => d.copy(), enabled: s => s.selectedNodes > 0 },
  'cut': { label: 'cut', run: d => d.cut(), enabled: editable(s => s.selectedNodes > 0) },
  'paste': { label: 'paste', run: d => d.paste(), enabled: editable(s => s.canPaste) },
  'delete': { label: 'delete', run: d => d.deleteSelection(), enabled: editable(s => s.selectedNodes + s.selectedEdges > 0) },
  'duplicate': { label: 'duplicate', run: d => d.duplicate(), enabled: editable(s => s.selectedNodes > 0) },
  'select-all': { label: 'selectAll', run: d => d.select({ nodes: d.schema.nodes.map(node => node.id), edges: d.schema.edges.map(edge => edge.id) }), enabled: s => s.nodes > 0 },
  'align-left': { label: 'alignLeft', run: d => d.align('left'), enabled: editable(s => s.selectedNodes >= 2) },
  'align-center': { label: 'alignCenter', run: d => d.align('center-vertical'), enabled: editable(s => s.selectedNodes >= 2) },
  'align-right': { label: 'alignRight', run: d => d.align('right'), enabled: editable(s => s.selectedNodes >= 2) },
  'align-top': { label: 'alignTop', run: d => d.align('top'), enabled: editable(s => s.selectedNodes >= 2) },
  'align-middle': { label: 'alignMiddle', run: d => d.align('center-horizontal'), enabled: editable(s => s.selectedNodes >= 2) },
  'align-bottom': { label: 'alignBottom', run: d => d.align('bottom'), enabled: editable(s => s.selectedNodes >= 2) },
  'distribute-horizontal': { label: 'distributeHorizontal', run: d => d.distribute('horizontal'), enabled: editable(s => s.selectedNodes >= 3) },
  'distribute-vertical': { label: 'distributeVertical', run: d => d.distribute('vertical'), enabled: editable(s => s.selectedNodes >= 3) },
  'auto-layout': { label: 'autoLayout', run: d => d.autoLayout(), enabled: editable(s => s.nodes > 0) },
  'clear-vertices': {
    label: 'clearVertices',
    run: (d) => {
      const selected = new Set(d.getSelection().edges)
      d.execute(d.schema.edges
        .filter(edge => selected.has(edge.id) && edge.vertices !== undefined)
        .map(edge => ({ type: 'updateEdge', id: edge.id, patch: { vertices: null } })))
    },
    enabled: editable(s => s.selectedVertices),
  },
  'zoom-out': { label: 'zoomOut', run: d => d.zoomOut(), enabled: always },
  'zoom-in': { label: 'zoomIn', run: d => d.zoomIn(), enabled: always },
  'zoom-to-fit': { label: 'zoomToFit', run: d => d.zoomToFit(), enabled: always },
  'zoom-to-actual': { label: 'zoomToActual', run: d => d.zoomToActual(), enabled: always },
}

/** 是否是命令名。 */
export function isCommand(value: string): value is FlowCommand {
  return Object.hasOwn(COMMANDS, value)
}

/** 读出判断命令可用要看的状态。 */
export function commandState(designer: XhFlowDesigner): CommandState {
  const selection = designer.getSelection()
  const selectedEdges = new Set(selection.edges)
  return {
    readonly: designer.readonly,
    canUndo: designer.canUndo,
    canRedo: designer.canRedo,
    canPaste: designer.canPaste,
    nodes: designer.schema.nodes.length,
    selectedNodes: selection.nodes.length,
    selectedEdges: selection.edges.length,
    selectedVertices: designer.schema.edges.some(edge => selectedEdges.has(edge.id) && edge.vertices !== undefined),
  }
}
