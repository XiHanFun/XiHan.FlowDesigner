/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的物料面板：节点类型按 category 分组交给 <xh-designer-palette>，扩展的物料来源现取的分组接在后面。点内置条目在
// 视口中央新建节点，拖出时载荷里的 payload 是节点类型，由画布这个放置目标在松手处新建；来源的条目交给那个来源插入。

import type { FlowNodeType, FlowNodeTypeRegistry, FlowPoint } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { DesignerPaletteDragPayload, DesignerPaletteEventMap, DesignerPaletteGroup, DesignerPaletteItem, DesignerPaletteView, XhDesignerPaletteElement } from '@xihan-ui/designer-shell'
import type { FlowDesignerContext, FlowPaletteSource } from '../extensions'
import { resolvePaletteSources } from '@xihan-ui/designer-shell'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'

/** 物料面板需要设计器提供的能力。 */
export interface PaletteHost {
  readonly ownerDocument: Document
  readonly isReadonly: () => boolean
  /** 在视口中央新建节点。 */
  readonly addNode: (type: string) => void
  /** 此刻交给命令与扩展的上下文：物料来源的条目被激活时交给它的 insert。 */
  readonly context: () => FlowDesignerContext
}

/** 物料分组的先后与标题：order 里列出的类别在前，labels 给类别换显示文字，缺省直接显示类别。 */
export interface PaletteGrouping {
  readonly order?: readonly string[]
  readonly labels?: Readonly<Record<string, string>>
}

/** 从物料面板拖出的节点类型；不是物料面板的载荷时为 undefined。 */
export function paletteNodeType(payload: unknown): string | undefined {
  const drag = payload as Partial<DesignerPaletteDragPayload> | undefined
  return drag?.source === 'palette' && typeof drag.payload === 'string' ? drag.payload : undefined
}

/** 物料面板：登记表、分组或文案变化时重排内置分组；有物料来源时每轮现取它们的分组，与上一轮逐项相同（图标与 payload 比引用）时不重设。 */
export class PalettePanel {
  readonly element: XhDesignerPaletteElement
  readonly #host: PaletteHost
  #inputs: readonly unknown[] = []
  #builtin: readonly DesignerPaletteGroup[] = []
  #view: DesignerPaletteView<FlowDesignerContext, FlowPoint> | undefined
  /** 物料来源的条目 id（含下级）。 */
  #sourceItems: ReadonlySet<string> = new Set()

  constructor(host: PaletteHost) {
    this.#host = host
    this.element = createGeneratedElement(host.ownerDocument, 'xh-designer-palette', { 'data-part': 'palette' })
    this.element.addEventListener('item-activate', (event) => {
      const { id, payload } = (event as DesignerPaletteEventMap['item-activate']).detail
      if (this.#sourceItems.has(id))
        this.#view?.insert(id, host.context())
      else if (typeof payload === 'string')
        host.addNode(payload)
    })
  }

  /** 这一条是不是物料来源的条目。 */
  isSourceItem(id: string): boolean {
    return this.#sourceItems.has(id)
  }

  /** 物料来源的条目拖到画布上放下：交给那个来源的 insert，at 是世界坐标；不是来源的条目返回 false。 */
  insert(id: string, at: FlowPoint): boolean {
    return this.#sourceItems.has(id) && (this.#view?.insert(id, this.#host.context(), at) ?? false)
  }

  update(registry: FlowNodeTypeRegistry, grouping: PaletteGrouping, t: FlowDesignerTranslations, sources: readonly FlowPaletteSource[]): void {
    this.element.readonly = this.#host.isReadonly()
    const inputs = [registry, grouping.order, grouping.labels, t.palette, t.paletteUncategorized]
    if (inputs.length !== this.#inputs.length || inputs.some((input, index) => input !== this.#inputs[index])) {
      this.#inputs = inputs
      this.element.translations = { title: t.palette }
      const { order = [], labels = {} } = grouping
      this.#builtin = groupTypes(registry.types, order).map((group): DesignerPaletteGroup => ({
        id: group.category ?? '',
        label: group.category === undefined ? t.paletteUncategorized : Object.hasOwn(labels, group.category) ? labels[group.category]! : group.category,
        items: group.types.map(nodeType => ({ id: nodeType.type, label: nodeType.label ?? nodeType.type, icon: nodeType.icon, payload: nodeType.type })),
      }))
    }
    const view = resolvePaletteSources(this.#builtin, sources, this.#host.context())
    this.#view = view
    this.#sourceItems = new Set(view.groups.slice(this.#builtin.length).flatMap(group => itemIds(group.items)))
    const current = this.element.groups
    if (current === undefined || !sameGroups(current, view.groups))
      this.element.groups = view.groups
  }
}

function sameGroups(a: readonly DesignerPaletteGroup[], b: readonly DesignerPaletteGroup[]): boolean {
  return a.length === b.length && a.every((group, index) => group.id === b[index]!.id && group.label === b[index]!.label && sameItems(group.items, b[index]!.items))
}

function sameItems(a: readonly DesignerPaletteItem[], b: readonly DesignerPaletteItem[]): boolean {
  return a.length === b.length && a.every((item, index) => {
    const other = b[index]!
    return item.id === other.id && item.label === other.label && item.icon === other.icon && item.description === other.description
      && item.disabled === other.disabled && item.browseOnly === other.browseOnly && Object.is(item.payload, other.payload)
      && (item.children === undefined) === (other.children === undefined) && sameItems(item.children ?? [], other.children ?? [])
  })
}

/** 条目连同下级的 id。 */
function itemIds(items: readonly DesignerPaletteItem[]): string[] {
  return items.flatMap(item => [item.id, ...itemIds(item.children ?? [])])
}

interface PaletteGroupOfTypes {
  readonly category: string | undefined
  readonly types: readonly FlowNodeType[]
}

/** 按类别分组：order 里列出的在前并按其顺序，其余按首次出现的顺序，没有类别的排最后。 */
function groupTypes(types: readonly FlowNodeType[], order: readonly string[]): PaletteGroupOfTypes[] {
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
  const groups: PaletteGroupOfTypes[] = ordered.map(category => ({ category, types: buckets.get(category)! }))
  const rest = buckets.get(undefined)
  if (rest)
    groups.push({ category: undefined, types: rest })
  return groups
}
