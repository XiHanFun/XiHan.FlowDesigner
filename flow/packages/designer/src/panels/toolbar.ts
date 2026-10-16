/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的工具栏：撤销重做、删除与副本、对齐分布、自动布局与缩放，放不下的收进行尾的「更多」菜单。

import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { XhFlowDesigner } from '../flow-designer'
import type { FlowCommand } from './commands'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'
import { h, setText } from '../dom'
import { COMMANDS, commandState, isCommand } from './commands'

const GROUPS: readonly (readonly FlowCommand[])[] = [
  ['undo', 'redo'],
  ['delete', 'duplicate'],
  ['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'distribute-horizontal', 'distribute-vertical', 'auto-layout'],
  ['zoom-out', 'zoom-in', 'zoom-to-fit', 'zoom-to-actual'],
]

/** 工具栏面板：外层容器里放一条 <xh-toolbar>，条目的文字与可用状态随设计器状态刷新。 */
export class ToolbarPanel {
  readonly element: HTMLElement
  readonly #designer: XhFlowDesigner
  readonly #root: HTMLElement
  readonly #items = new Map<FlowCommand, HTMLButtonElement>()

  constructor(designer: XhFlowDesigner) {
    this.#designer = designer
    const doc = designer.ownerDocument
    const children: HTMLElement[] = []
    GROUPS.forEach((group, index) => {
      if (index > 0)
        children.push(h(doc, 'div', { 'data-xh-part': 'separator' }))
      children.push(h(doc, 'div', { 'data-xh-part': 'group' }, group.map((command) => {
        const item = h(doc, 'button', { 'data-xh-part': 'item', 'type': 'button', 'value': command })
        this.#items.set(command, item)
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
    const state = commandState(this.#designer)
    this.#root.setAttribute('aria-label', t.toolbar)
    for (const [command, item] of this.#items) {
      const spec = COMMANDS[command]
      setText(item, t[spec.label])
      const disabled = !spec.enabled(state)
      if (item.disabled !== disabled)
        item.disabled = disabled
    }
  }

  readonly #onClick = (event: MouseEvent): void => {
    const item = (event.target as Element | null)?.closest<HTMLButtonElement>('button[value]')
    if (!item || item.disabled || !isCommand(item.value))
      return
    COMMANDS[item.value].run(this.#designer)
  }
}
