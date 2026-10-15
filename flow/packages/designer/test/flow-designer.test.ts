/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDocument } from '@xihan-flow/core'
import type { XhFlowDesigner } from '../src'
import { createNodeTypeRegistry } from '@xihan-flow/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner, FLOW_DESIGNER_TAG } from '../src'

defineFlowDesigner()

const registry = createNodeTypeRegistry([
  { type: 'start', size: { width: 100, height: 40 }, ports: 'out', entry: true },
  { type: 'task', size: { width: 100, height: 40 }, ports: 'both' },
  { type: 'end', size: { width: 100, height: 40 }, ports: 'in', terminal: true },
])

function sample(): FlowDocument {
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

async function mount(setup: (designer: XhFlowDesigner) => void = () => {}): Promise<XhFlowDesigner> {
  const designer = window.document.createElement(FLOW_DESIGNER_TAG)
  designer.nodeTypes = registry
  designer.schema = sample()
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
})

function part(designer: Element, name: string): HTMLElement[] {
  return Array.from(designer.querySelectorAll<HTMLElement>(`[data-part="${name}"]`))
}

function nodeElement(designer: Element, id: string): HTMLElement {
  return designer.querySelector<HTMLElement>(`[data-part="node"][data-node-id="${id}"]`)!
}

function portElement(designer: Element, node: string, port: string): HTMLElement {
  return designer.querySelector<HTMLElement>(`[data-part="port"][data-node-id="${node}"][data-port-id="${port}"]`)!
}

function press(target: Element, x: number, y: number, init: PointerEventInit = {}): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: x, clientY: y, bubbles: true, ...init }))
}

function move(x: number, y: number): void {
  window.document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y }))
}

function release(x: number, y: number): void {
  window.document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y }))
}

function key(designer: XhFlowDesigner, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  part(designer, 'viewport')[0]!.dispatchEvent(event)
  return event
}

describe('<xh-flow-designer>', () => {
  it('画出节点、连线与端口', async () => {
    const designer = await mount()
    expect(part(designer, 'node').map(node => node.dataset.nodeId)).toEqual(['s', 't', 'e'])
    expect(part(designer, 'edge')).toHaveLength(1)
    expect(part(designer, 'port').map(port => `${port.dataset.nodeId}:${port.dataset.portId}:${port.dataset.direction}`)).toEqual([
      's:out:out',
      't:in:in',
      't:out:out',
      'e:in:in',
    ])
  })

  it('点选节点，Shift 点选追加与取消，点空白清空选择', async () => {
    const designer = await mount()
    const changes: unknown[] = []
    designer.addEventListener('selection-change', event => changes.push((event as CustomEvent).detail))
    press(nodeElement(designer, 's'), 10, 10)
    release(10, 10)
    await designer.updateComplete
    expect(nodeElement(designer, 's').hasAttribute('data-selected')).toBe(true)
    press(nodeElement(designer, 't'), 210, 10, { shiftKey: true })
    release(210, 10)
    expect(designer.getSelection()).toEqual({ nodes: ['s', 't'], edges: [] })
    press(nodeElement(designer, 's'), 10, 10, { shiftKey: true })
    release(10, 10)
    expect(designer.getSelection().nodes).toEqual(['t'])
    press(part(designer, 'viewport')[0]!, 700, 700)
    release(700, 700)
    expect(designer.getSelection()).toEqual({ nodes: [], edges: [] })
    expect(changes).toHaveLength(4)
  })

  it('拖动节点记为一步撤销，位置吸附网格，只派发一次 schema-change', async () => {
    const designer = await mount(element => element.snap = false)
    const changes: { kind: string, operations: unknown[] }[] = []
    designer.addEventListener('schema-change', event => changes.push((event as CustomEvent).detail))
    press(nodeElement(designer, 't'), 210, 10)
    move(213, 12)
    expect(changes).toHaveLength(0)
    move(240, 30)
    move(253, 45)
    release(253, 45)
    const moved = designer.schema.nodes.find(node => node.id === 't')!
    expect([moved.x, moved.y]).toEqual([240, 32])
    expect(changes).toHaveLength(1)
    expect(changes[0]!.kind).toBe('execute')
    expect(designer.canUndo).toBe(true)
    designer.undo()
    expect(designer.schema).toEqual(sample())
  })

  it('拖动中按 Esc 放弃，定义回到拖动前', async () => {
    const designer = await mount(element => element.grid = false)
    press(nodeElement(designer, 's'), 10, 10)
    move(60, 60)
    expect(designer.schema.nodes[0]!.x).not.toBe(0)
    key(designer, { key: 'Escape' })
    release(60, 60)
    expect(designer.schema).toEqual(sample())
    expect(designer.canUndo).toBe(false)
  })

  it('从出口拖到节点上新建连线，违反约束时派发 connect-reject', async () => {
    const designer = await mount()
    const rejects: unknown[] = []
    designer.addEventListener('connect-reject', event => rejects.push((event as CustomEvent).detail))
    press(portElement(designer, 't', 'out'), 300, 20)
    move(420, 210)
    await designer.updateComplete
    expect(part(designer, 'connect-preview')[0]!.getAttribute('data-valid')).toBe('true')
    release(420, 210)
    expect(designer.schema.edges.at(-1)).toEqual({ id: 'edge_1', source: { node: 't', port: 'out' }, target: { node: 'e' } })
    expect(designer.getSelection()).toEqual({ nodes: [], edges: ['edge_1'] })
    await designer.updateComplete
    expect(part(designer, 'connect-preview').length).toBe(0)

    press(portElement(designer, 't', 'out'), 300, 20)
    move(50, 20)
    release(50, 20)
    expect(rejects).toEqual([{
      source: { node: 't', port: 'out' },
      target: { node: 's' },
      problems: [{ code: 'edge.invalid-direction', end: 'target', params: {} }],
    }])
    expect(designer.schema.edges).toHaveLength(2)
  })

  it('入口不能拖出连线，拖到空白处不连', async () => {
    const designer = await mount()
    press(portElement(designer, 't', 'in'), 200, 20)
    move(500, 500)
    release(500, 500)
    press(portElement(designer, 's', 'out'), 100, 20)
    move(700, 700)
    release(700, 700)
    expect(designer.schema).toEqual(sample())
  })

  it('按住 Shift 拖空白框选', async () => {
    const designer = await mount()
    press(part(designer, 'viewport')[0]!, -10, -10, { shiftKey: true })
    move(310, 50)
    await designer.updateComplete
    expect(part(designer, 'marquee')[0]!.hidden).toBe(false)
    expect(designer.getSelection().nodes).toEqual(['s', 't'])
    release(310, 50)
    await designer.updateComplete
    expect(part(designer, 'marquee')[0]!.hidden).toBe(true)
  })

  it('拖空白平移视口', async () => {
    const designer = await mount()
    press(part(designer, 'viewport')[0]!, 100, 100)
    move(150, 130)
    release(150, 130)
    expect(designer.getViewport()).toEqual({ x: 50, y: 30, zoom: 1 })
  })

  it('快捷键：删除、撤销重做、全选、复制粘贴、微移与保存', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    expect(key(designer, { key: 'Delete' }).defaultPrevented).toBe(true)
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 'e'])
    expect(designer.schema.edges).toEqual([])
    key(designer, { key: 'z', ctrlKey: true })
    expect(designer.schema).toEqual(sample())
    key(designer, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(designer.schema.nodes).toHaveLength(2)
    key(designer, { key: 'y', metaKey: true })
    key(designer, { key: 'z', ctrlKey: true })
    key(designer, { key: 'a', ctrlKey: true })
    expect(designer.getSelection()).toEqual({ nodes: ['s', 't', 'e'], edges: ['st'] })
    designer.select({ nodes: ['s'] })
    key(designer, { key: 'c', ctrlKey: true })
    key(designer, { key: 'v', ctrlKey: true })
    expect(designer.schema.nodes.at(-1)).toMatchObject({ id: 'start_1', x: 16, y: 16 })
    key(designer, { key: 'ArrowRight' })
    key(designer, { key: 'ArrowRight', shiftKey: true })
    expect(designer.schema.nodes.at(-1)).toMatchObject({ x: 33, y: 16 })
    const saves: unknown[] = []
    designer.addEventListener('save', () => saves.push(1))
    expect(key(designer, { key: 's', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(saves).toHaveLength(1)
  })

  it('只读时可以选择，不能移动、连线或删除', async () => {
    const designer = await mount(element => element.readonly = true)
    expect(designer.hasAttribute('data-readonly')).toBe(true)
    press(nodeElement(designer, 't'), 210, 10)
    move(300, 100)
    release(300, 100)
    expect(designer.getSelection().nodes).toEqual(['t'])
    key(designer, { key: 'Delete' })
    expect(designer.schema).toEqual(sample())
  })

  it('装载派发 load，赋回同一份不重新装载；修改后脏标记随保存变化', async () => {
    const designer = await mount()
    const kinds: string[] = []
    const dirty: boolean[] = []
    designer.addEventListener('schema-change', event => kinds.push((event as CustomEvent).detail.kind))
    designer.addEventListener('dirty-change', event => dirty.push((event as CustomEvent).detail.dirty))
    const current = designer.schema
    designer.schema = current
    expect(kinds).toEqual([])
    designer.addNode('task', { x: 50, y: 300 })
    expect(designer.schema.nodes.at(-1)).toMatchObject({ id: 'task_1', x: 0, y: 288 })
    expect(designer.dirty).toBe(true)
    designer.markSaved()
    designer.schema = sample()
    expect(kinds).toEqual(['execute', 'load'])
    expect(dirty).toEqual([true, false])
    expect(designer.canUndo).toBe(false)
  })

  describe('自动适配', () => {
    const observers: FakeResizeObserver[] = []

    class FakeResizeObserver {
      readonly targets = new Set<Element>()
      constructor(readonly callback: () => void) {
        observers.push(this)
      }

      observe(target: Element): void {
        this.targets.add(target)
      }

      disconnect(): void {
        this.targets.clear()
      }
    }

    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    })

    afterEach(() => {
      observers.length = 0
      vi.unstubAllGlobals()
    })

    function resize(designer: XhFlowDesigner, width: number, height: number): void {
      const root = part(designer, 'viewport')[0]!
      Object.defineProperty(root, 'clientWidth', { configurable: true, value: width })
      Object.defineProperty(root, 'clientHeight', { configurable: true, value: height })
      for (const observer of observers.filter(observer => observer.targets.has(root)))
        observer.callback()
    }

    it('首次拿到非零尺寸时适配，之后尺寸变化继续适配，编辑不触发适配', async () => {
      const designer = await mount()
      expect(designer.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 })
      resize(designer, 600, 300)
      expect(designer.getViewport()).toEqual({ x: 50, y: 30, zoom: 1 })
      resize(designer, 300, 300)
      expect(designer.getViewport().zoom).toBeCloseTo(252 / 500)
      resize(designer, 600, 300)
      designer.addNode('task', { x: 1000, y: 20 })
      await designer.updateComplete
      expect(designer.getViewport()).toEqual({ x: 50, y: 30, zoom: 1 })
    })

    it('宿主设置过视口后不再适配，在尺寸到来之前设置的也算', async () => {
      const early = await mount(element => element.setViewport({ x: 1, y: 2, zoom: 1 }))
      resize(early, 600, 300)
      expect(early.getViewport()).toEqual({ x: 1, y: 2, zoom: 1 })

      const later = await mount()
      resize(later, 600, 300)
      later.zoomOut()
      const zoomed = later.getViewport()
      resize(later, 300, 300)
      expect(later.getViewport()).toBe(zoomed)
    })

    it('在画布上按下指针后不再适配，zoomToFit 与重新装载都会重新开启', async () => {
      const designer = await mount()
      resize(designer, 600, 300)
      press(nodeElement(designer, 's'), 10, 10)
      release(10, 10)
      resize(designer, 300, 300)
      expect(designer.getViewport()).toEqual({ x: 50, y: 30, zoom: 1 })
      designer.zoomToFit()
      expect(designer.getViewport().zoom).toBeCloseTo(252 / 500)
      resize(designer, 600, 300)
      expect(designer.getViewport()).toEqual({ x: 50, y: 30, zoom: 1 })

      designer.setViewport({ x: 1, y: 2, zoom: 1 })
      designer.schema = sample()
      await designer.updateComplete
      expect(designer.getViewport()).toEqual({ x: 50, y: 30, zoom: 1 })
    })
  })

  it('定义或节点类型变化后在同一轮里派发一次 issues-change', async () => {
    const designer = await mount()
    const issues: unknown[][] = []
    designer.addEventListener('issues-change', event => issues.push((event as CustomEvent).detail.issues))
    designer.addNode('task', { x: 0, y: 400 })
    designer.addNode('task', { x: 200, y: 400 })
    await Promise.resolve()
    expect(issues).toHaveLength(1)
    expect(issues[0]!.map(issue => (issue as { code: string }).code)).toContain('node.isolated')
  })
})
