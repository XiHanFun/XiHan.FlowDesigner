/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的物料面板：节点类型按 category 分组，点击在视口中央新建节点，拖进画布在松手处新建。

import type { FlowNodeType, FlowNodeTypeRegistry } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'
import { h, setText } from '../dom'

/** 物料面板需要设计器提供的能力。 */
export interface PaletteHost {
  readonly ownerDocument: Document
  readonly isReadonly: () => boolean
  /** 生成文档内不重复的元素 id。 */
  readonly nextId: () => string
  /** 在视口中央新建节点。 */
  readonly addNode: (type: string) => void
  /** 从物料条目开始一次拖动；拖动成立时返回 true。 */
  readonly startDrag: (event: PointerEvent, type: string, onEnd: (dragged: boolean) => void) => boolean
}

/** 物料分组的先后与标题：order 里列出的类别在前，labels 给类别换显示文字，缺省直接显示类别。 */
export interface PaletteGrouping {
  readonly order?: readonly string[]
  readonly labels?: Readonly<Record<string, string>>
}

interface PaletteGroup {
  readonly category: string | undefined
  readonly types: readonly FlowNodeType[]
}

/** 物料面板：登记表或文案变化时整块重建，只读时条目禁用。 */
export class PalettePanel {
  readonly element: HTMLElement
  readonly #host: PaletteHost
  readonly #title: HTMLElement
  readonly #body: HTMLElement
  #registry: FlowNodeTypeRegistry | undefined
  #grouping: PaletteGrouping = {}
  #uncategorized = ''
  #suppressClick = false

  constructor(host: PaletteHost) {
    this.#host = host
    const doc = host.ownerDocument
    this.element = createGeneratedElement(doc, 'div')
    this.element.dataset.part = 'palette'
    this.element.setAttribute('role', 'region')
    this.#title = h(doc, 'div', { 'data-part': 'palette-title', 'id': host.nextId() })
    this.#body = h(doc, 'div', { 'data-part': 'palette-body' })
    this.element.setAttribute('aria-labelledby', this.#title.id)
    this.element.append(this.#title, this.#body)
    this.#body.addEventListener('pointerdown', this.#onPointerDown)
    this.#body.addEventListener('click', this.#onClick)
  }

  update(registry: FlowNodeTypeRegistry, grouping: PaletteGrouping, t: FlowDesignerTranslations): void {
    setText(this.#title, t.palette)
    const changed = registry !== this.#registry
      || grouping.order !== this.#grouping.order
      || grouping.labels !== this.#grouping.labels
      || t.paletteUncategorized !== this.#uncategorized
    if (changed) {
      this.#registry = registry
      this.#grouping = grouping
      this.#uncategorized = t.paletteUncategorized
      this.#render(registry)
    }
    for (const item of this.#body.querySelectorAll<HTMLButtonElement>('[data-part="palette-item"]')) {
      if (item.disabled !== this.#host.isReadonly())
        item.disabled = this.#host.isReadonly()
    }
  }

  #render(registry: FlowNodeTypeRegistry): void {
    const doc = this.#host.ownerDocument
    const { order = [], labels = {} } = this.#grouping
    this.#body.replaceChildren(...groupTypes(registry.types, order).map((group) => {
      const text = group.category === undefined ? this.#uncategorized : Object.hasOwn(labels, group.category) ? labels[group.category]! : group.category
      const label = h(doc, 'div', { 'data-part': 'palette-group-label', 'id': this.#host.nextId() }, [text])
      const items = group.types.map(nodeType => h(doc, 'button', {
        'data-part': 'palette-item',
        'type': 'button',
        'data-node-type': nodeType.type,
      }, [nodeType.label ?? nodeType.type]))
      return h(doc, 'div', { 'data-part': 'palette-group', 'role': 'group', 'aria-labelledby': label.id }, [label, ...items])
    }))
  }

  #itemOf(event: Event): HTMLButtonElement | undefined {
    const item = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-part="palette-item"]')
    return item && this.#body.contains(item) && !item.disabled ? item : undefined
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    const item = this.#itemOf(event)
    if (!item || event.button !== 0)
      return
    this.#suppressClick = false
    const started = this.#host.startDrag(event, item.dataset.nodeType!, (dragged) => {
      delete item.dataset.dragging
      this.#suppressClick = dragged
    })
    if (started)
      item.dataset.dragging = ''
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.#suppressClick) {
      this.#suppressClick = false
      return
    }
    const item = this.#itemOf(event)
    if (item)
      this.#host.addNode(item.dataset.nodeType!)
  }
}

/** 按类别分组：order 里列出的在前并按其顺序，其余按首次出现的顺序，没有类别的排最后。 */
function groupTypes(types: readonly FlowNodeType[], order: readonly string[]): PaletteGroup[] {
  const buckets = new Map<string | undefined, FlowNodeType[]>()
  for (const nodeType of types) {
    const bucket = buckets.get(nodeType.category)
    if (bucket)
      bucket.push(nodeType)
    else
      buckets.set(nodeType.category, [nodeType])
  }
  const named = [...buckets.keys()].filter((category): category is string => category !== undefined)
  const ordered = [...order.filter(category => buckets.has(category)), ...named.filter(category => !order.includes(category))]
  const groups: PaletteGroup[] = ordered.map(category => ({ category, types: buckets.get(category)! }))
  const rest = buckets.get(undefined)
  if (rest)
    groups.push({ category: undefined, types: rest })
  return groups
}
