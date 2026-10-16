/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的工具栏：撤销重做、删除与副本、对齐分布、自动布局与缩放，放不下的收进行尾的「更多」菜单。

import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { XhFlowDesigner } from '../flow-designer'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'
import { h, setText } from '../dom'

/** 工具栏命令。 */
export type FlowToolbarCommand
  = | 'undo'
    | 'redo'
    | 'delete'
    | 'duplicate'
    | 'align-left'
    | 'align-center'
    | 'align-right'
    | 'align-top'
    | 'align-middle'
    | 'align-bottom'
    | 'distribute-horizontal'
    | 'distribute-vertical'
    | 'auto-layout'
    | 'zoom-out'
    | 'zoom-in'
    | 'zoom-to-fit'
    | 'zoom-to-actual'

/** 取值是字符串的文案键。 */
type TextKey = { [K in keyof FlowDesignerTranslations]: FlowDesignerTranslations[K] extends string ? K : never }[keyof FlowDesignerTranslations]

interface CommandSpec {
  readonly command: FlowToolbarCommand
  readonly label: TextKey
  readonly run: (designer: XhFlowDesigner) => void
  /** 只读时也能用的命令（视口类）不看 readonly。 */
  readonly enabled: (state: ToolbarState) => boolean
}

interface ToolbarState {
  readonly readonly: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly nodes: number
  readonly selectedNodes: number
  readonly selectedEdges: number
}

const editable = (test: (state: ToolbarState) => boolean) => (state: ToolbarState): boolean => !state.readonly && test(state)
const always = (): boolean => true

const GROUPS: readonly (readonly CommandSpec[])[] = [
  [
    { command: 'undo', label: 'undo', run: d => d.undo(), enabled: editable(s => s.canUndo) },
    { command: 'redo', label: 'redo', run: d => d.redo(), enabled: editable(s => s.canRedo) },
  ],
  [
    { command: 'delete', label: 'delete', run: d => d.deleteSelection(), enabled: editable(s => s.selectedNodes + s.selectedEdges > 0) },
    { command: 'duplicate', label: 'duplicate', run: d => d.duplicate(), enabled: editable(s => s.selectedNodes > 0) },
  ],
  [
    { command: 'align-left', label: 'alignLeft', run: d => d.align('left'), enabled: editable(s => s.selectedNodes >= 2) },
    { command: 'align-center', label: 'alignCenter', run: d => d.align('center-vertical'), enabled: editable(s => s.selectedNodes >= 2) },
    { command: 'align-right', label: 'alignRight', run: d => d.align('right'), enabled: editable(s => s.selectedNodes >= 2) },
    { command: 'align-top', label: 'alignTop', run: d => d.align('top'), enabled: editable(s => s.selectedNodes >= 2) },
    { command: 'align-middle', label: 'alignMiddle', run: d => d.align('center-horizontal'), enabled: editable(s => s.selectedNodes >= 2) },
    { command: 'align-bottom', label: 'alignBottom', run: d => d.align('bottom'), enabled: editable(s => s.selectedNodes >= 2) },
    { command: 'distribute-horizontal', label: 'distributeHorizontal', run: d => d.distribute('horizontal'), enabled: editable(s => s.selectedNodes >= 3) },
    { command: 'distribute-vertical', label: 'distributeVertical', run: d => d.distribute('vertical'), enabled: editable(s => s.selectedNodes >= 3) },
    { command: 'auto-layout', label: 'autoLayout', run: d => d.autoLayout(), enabled: editable(s => s.nodes > 0) },
  ],
  [
    { command: 'zoom-out', label: 'zoomOut', run: d => d.zoomOut(), enabled: always },
    { command: 'zoom-in', label: 'zoomIn', run: d => d.zoomIn(), enabled: always },
    { command: 'zoom-to-fit', label: 'zoomToFit', run: d => d.zoomToFit(), enabled: always },
    { command: 'zoom-to-actual', label: 'zoomToActual', run: d => d.zoomToActual(), enabled: always },
  ],
]

const SPECS = new Map(GROUPS.flat().map(spec => [spec.command, spec]))

/** 工具栏面板：外层容器里放一条 <xh-toolbar>，条目的文字与可用状态随设计器状态刷新。 */
export class ToolbarPanel {
  readonly element: HTMLElement
  readonly #designer: XhFlowDesigner
  readonly #root: HTMLElement
  readonly #items = new Map<FlowToolbarCommand, HTMLButtonElement>()

  constructor(designer: XhFlowDesigner) {
    this.#designer = designer
    const doc = designer.ownerDocument
    const children: HTMLElement[] = []
    GROUPS.forEach((group, index) => {
      if (index > 0)
        children.push(h(doc, 'div', { 'data-xh-part': 'separator' }))
      children.push(h(doc, 'div', { 'data-xh-part': 'group' }, group.map((spec) => {
        const item = h(doc, 'button', { 'data-xh-part': 'item', 'type': 'button', 'value': spec.command })
        this.#items.set(spec.command, item)
        return item
      })))
    })
    children.push(h(doc, 'button', { 'data-xh-part': 'overflow-trigger', 'type': 'button' }))
    this.#root = h(doc, 'div', { 'data-xh-part': 'root' }, children)
    this.element = createGeneratedElement(doc, 'div')
    this.element.dataset.part = 'toolbar'
    this.element.append(h(doc, 'xh-toolbar', { size: 'sm' }, [this.#root]))
    this.#root.addEventListener('click', this.#onClick)
  }

  update(t: FlowDesignerTranslations): void {
    const designer = this.#designer
    const selection = designer.getSelection()
    const state: ToolbarState = {
      readonly: designer.readonly,
      canUndo: designer.canUndo,
      canRedo: designer.canRedo,
      nodes: designer.schema.nodes.length,
      selectedNodes: selection.nodes.length,
      selectedEdges: selection.edges.length,
    }
    this.#root.setAttribute('aria-label', t.toolbar)
    for (const [command, item] of this.#items) {
      const spec = SPECS.get(command)!
      setText(item, t[spec.label])
      const disabled = !spec.enabled(state)
      if (item.disabled !== disabled)
        item.disabled = disabled
    }
  }

  readonly #onClick = (event: MouseEvent): void => {
    const item = (event.target as Element | null)?.closest<HTMLButtonElement>('button[value]')
    const spec = item && SPECS.get(item.value as FlowToolbarCommand)
    if (!item || !spec || item.disabled)
      return
    spec.run(this.#designer)
  }
}
