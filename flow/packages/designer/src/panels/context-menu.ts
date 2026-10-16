/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的内置右键菜单：整块画布是 UI <xh-context-menu> 的触发区，右键节点、连线或空白处时换上对应的条目。

import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { XhFlowDesigner } from '../flow-designer'
import type { FlowCommand } from './commands'
import { h } from '../dom'
import { COMMANDS, commandState, isCommand } from './commands'

/** 右键落在哪类对象上。 */
export type ContextMenuSubject = 'node' | 'edge' | 'blank'

/** 分隔线。 */
const SEPARATOR = '|'

/** 右键菜单：prepare 按对象换条目，选中条目时执行对应命令。 */
export class ContextMenuPanel {
  /** <xh-context-menu> 本身，放进画布区。 */
  readonly element: HTMLElement
  /** 触发区：包住画布视口，承担画布的焦点与键盘。 */
  readonly trigger: HTMLElement
  readonly #designer: XhFlowDesigner
  readonly #content: HTMLElement

  constructor(designer: XhFlowDesigner, viewport: HTMLElement) {
    this.#designer = designer
    const doc = designer.ownerDocument
    this.trigger = h(doc, 'div', { 'data-xh-part': 'trigger', 'data-flow-canvas': '', 'role': 'region' }, [viewport])
    this.#content = h(doc, 'div', { 'data-xh-part': 'content' })
    this.element = h(doc, 'xh-context-menu', { size: 'sm' }, [
      h(doc, 'div', { 'data-xh-part': 'root', 'data-flow-menu-root': '' }, [
        this.trigger,
        h(doc, 'div', { 'data-xh-part': 'positioner' }, [this.#content]),
      ]),
    ])
    this.element.addEventListener('select', this.#onSelect)
  }

  /** 按对象换上条目；条目的可用状态取此刻设计器的状态。 */
  prepare(subject: ContextMenuSubject, t: FlowDesignerTranslations): void {
    const doc = this.#designer.ownerDocument
    const state = commandState(this.#designer)
    this.#content.replaceChildren(...entries(subject, state.selectedNodes).map((entry) => {
      if (entry === SEPARATOR)
        return h(doc, 'div', { 'data-xh-part': 'separator' })
      const spec = COMMANDS[entry]
      return h(doc, 'div', {
        'data-xh-part': 'item',
        'value': entry,
        'aria-disabled': spec.enabled(state) ? undefined : 'true',
      }, [h(doc, 'span', { 'data-xh-part': 'item-text' }, [t[spec.label]])])
    }))
  }

  readonly #onSelect = (event: Event): void => {
    const { value } = (event as CustomEvent<{ value: string }>).detail
    if (!isCommand(value))
      return
    const spec = COMMANDS[value]
    if (spec.enabled(commandState(this.#designer)))
      spec.run(this.#designer)
  }
}

function entries(subject: ContextMenuSubject, selectedNodes: number): (FlowCommand | typeof SEPARATOR)[] {
  if (subject === 'edge')
    return ['delete']
  if (subject === 'blank')
    return ['paste', 'select-all', SEPARATOR, 'auto-layout', 'zoom-to-fit']
  const list: (FlowCommand | typeof SEPARATOR)[] = ['duplicate', 'copy', 'delete']
  if (selectedNodes >= 2)
    list.push(SEPARATOR, 'align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom')
  if (selectedNodes >= 3)
    list.push('distribute-horizontal', 'distribute-vertical')
  return list
}
