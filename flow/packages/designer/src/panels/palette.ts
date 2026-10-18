/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的物料面板：节点类型按 category 分组交给 <xh-designer-palette>。点条目在视口中央新建节点，
// 拖出时载荷里的 payload 是节点类型，由画布这个放置目标在松手处新建。

import type { FlowNodeType, FlowNodeTypeRegistry } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { DesignerPaletteDragPayload, DesignerPaletteEventMap, DesignerPaletteGroup, XhDesignerPaletteElement } from '@xihan-ui/designer-shell'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'

/** 物料面板需要设计器提供的能力。 */
export interface PaletteHost {
  readonly ownerDocument: Document
  readonly isReadonly: () => boolean
  /** 在视口中央新建节点。 */
  readonly addNode: (type: string) => void
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

/** 物料面板：登记表、分组或文案变化时重排分组。 */
export class PalettePanel {
  readonly element: XhDesignerPaletteElement
  readonly #host: PaletteHost
  #inputs: readonly unknown[] = []

  constructor(host: PaletteHost) {
    this.#host = host
    this.element = createGeneratedElement(host.ownerDocument, 'xh-designer-palette', { 'data-part': 'palette' })
    this.element.addEventListener('item-activate', (event) => {
      const { payload } = (event as DesignerPaletteEventMap['item-activate']).detail
      if (typeof payload === 'string')
        host.addNode(payload)
    })
  }

  update(registry: FlowNodeTypeRegistry, grouping: PaletteGrouping, t: FlowDesignerTranslations): void {
    this.element.readonly = this.#host.isReadonly()
    const inputs = [registry, grouping.order, grouping.labels, t.palette, t.paletteUncategorized]
    if (inputs.length === this.#inputs.length && inputs.every((input, index) => input === this.#inputs[index]))
      return
    this.#inputs = inputs
    this.element.translations = { title: t.palette }
    const { order = [], labels = {} } = grouping
    this.element.groups = groupTypes(registry.types, order).map((group): DesignerPaletteGroup => ({
      id: group.category ?? '',
      label: group.category === undefined ? t.paletteUncategorized : Object.hasOwn(labels, group.category) ? labels[group.category]! : group.category,
      items: group.types.map(nodeType => ({ id: nodeType.type, label: nodeType.label ?? nodeType.type, icon: nodeType.icon, payload: nodeType.type })),
    }))
  }
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
