/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的右键菜单：整块画布是 UI <xh-context-menu> 的触发区，右键节点、连线或空白处时换上对应的命令。

import { createAuthoredElement } from '@xihan-ui/web-components/authoring'

/** 右键菜单：条目由设计器铺进 content，选中条目时把命令 id 交给 onSelect。 */
export class ContextMenuPanel {
  /** <xh-context-menu> 本身，放进画布区。 */
  readonly element: HTMLElement
  /** 触发区：包住画布视口，承担画布的焦点与键盘。 */
  readonly trigger: HTMLElement
  /** 放条目的容器。 */
  readonly content: HTMLElement

  constructor(doc: Document, viewport: HTMLElement, onSelect: (id: string) => void) {
    this.trigger = createAuthoredElement(doc, 'div', { 'data-xh-part': 'trigger', 'data-flow-canvas': '', 'role': 'region' }, [viewport])
    this.content = createAuthoredElement(doc, 'div', { 'data-xh-part': 'content' })
    this.element = createAuthoredElement(doc, 'xh-context-menu', { size: 'sm' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'root', 'data-flow-menu-root': '' }, [
        this.trigger,
        createAuthoredElement(doc, 'div', { 'data-xh-part': 'positioner' }, [this.content]),
      ]),
    ])
    this.element.addEventListener('item-select', (event) => {
      onSelect((event as CustomEvent<{ value: string }>).detail.value)
    })
  }
}
