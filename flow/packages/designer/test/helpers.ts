/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器用例共用的挂载与指针工具。

import type { FlowDocument, FlowNodeTypeDefinition } from '@xihan-flow/core'
import type { FlowDesignerExtension, XhFlowDesigner } from '../src'
import { FLOW_DESIGNER_TAG } from '../src'

export const definitions: readonly FlowNodeTypeDefinition[] = [
  { type: 'start', label: '开始', category: '事件', size: { width: 100, height: 40 }, ports: 'out', entry: true },
  { type: 'task', label: '任务', category: '活动', size: { width: 100, height: 40 }, ports: 'both' },
  { type: 'end', label: '结束', category: '事件', size: { width: 100, height: 40 }, ports: 'in', terminal: true },
  { type: 'note', size: { width: 80, height: 40 }, ports: 'none' },
]

/** 用例的节点类型，以一个扩展交给设计器。 */
export const nodes: FlowDesignerExtension = { id: 'test', nodeTypes: definitions }

export function sample(): FlowDocument {
  return {
    version: 1,
    nodes: [
      { id: 's', type: 'start', x: 0, y: 0, width: 100, height: 40 },
      { id: 't', type: 'task', x: 200, y: 0, width: 100, height: 40 },
      { id: 'e', type: 'end', x: 400, y: 200, width: 100, height: 40 },
    ],
    edges: [{ id: 'st', source: { node: 's' }, target: { node: 't' } }],
  }
}

const mounted: Element[] = []

export async function mount(setup: (designer: XhFlowDesigner) => void = () => {}): Promise<XhFlowDesigner> {
  const designer = window.document.createElement(FLOW_DESIGNER_TAG)
  designer.autoTour = false
  designer.extensions = [nodes]
  designer.schema = sample()
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

export function unmountAll(): void {
  for (const element of mounted.splice(0))
    element.remove()
}

export function part(root: Element, name: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-part="${name}"]`))
}

export function press(target: Element, x: number, y: number, init: PointerEventInit = {}): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true, ...init }))
}

export function move(x: number, y: number): void {
  window.document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y }))
}

export function release(x: number, y: number): void {
  window.document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y }))
}

/** 让画布在浏览器视口里占 (0, 0) 起的 width × height。 */
export function placeCanvas(designer: XhFlowDesigner, width: number, height: number): void {
  const root = part(designer, 'viewport')[0]!
  Object.defineProperty(root, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: height })
  root.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) })
}
