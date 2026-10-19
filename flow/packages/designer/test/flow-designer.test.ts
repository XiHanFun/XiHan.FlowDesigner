/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDocument } from '@xihan-flow/core'
import type { FlowDesignerExtension, XhFlowDesigner } from '../src'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFlowClipboard, defineFlowDesigner, encodeFlowClipboard, FLOW_DESIGNER_TAG } from '../src'

defineFlowDesigner()

const nodes: FlowDesignerExtension = {
  id: 'test',
  nodeTypes: [
    { type: 'start', size: { width: 100, height: 40 }, ports: 'out', entry: true },
    { type: 'task', size: { width: 100, height: 40 }, ports: 'both' },
    { type: 'end', size: { width: 100, height: 40 }, ports: 'in', terminal: true },
  ],
}

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
  designer.autoTour = false
  designer.extensions = [nodes]
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

function move(x: number, y: number, init: PointerEventInit = {}): void {
  window.document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y, ...init }))
}

function release(x: number, y: number, init: PointerEventInit = {}): void {
  window.document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y, ...init }))
}

/** 剪贴板事件的数据：按类型存取的文本。 */
function clipboardData(initial: Readonly<Record<string, string>> = {}): DataTransfer & { readonly store: Map<string, string> } {
  const store = new Map(Object.entries(initial))
  return {
    store,
    getData: (type: string) => store.get(type) ?? '',
    setData: (type: string, value: string) => void store.set(type, value),
  } as unknown as DataTransfer & { readonly store: Map<string, string> }
}

/** 从 body 派发剪贴板事件，jsdom 里补上 clipboardData。 */
function clip(type: 'copy' | 'cut' | 'paste', data: DataTransfer): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  window.document.body.dispatchEvent(event)
  return event
}

function focusCanvas(designer: XhFlowDesigner): void {
  designer.querySelector<HTMLElement>('[data-flow-canvas]')!.focus()
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

  it('写了显示名的端口把名字画在端口外侧，按所在的边标出 data-side；没有显示名的不带，去掉后撤掉', async () => {
    const branching = (yes?: string): FlowDesignerExtension => ({
      id: 'test',
      nodeTypes: [nodes.nodeTypes![0]!, {
        type: 'task',
        size: { width: 100, height: 40 },
        ports: [
          { id: 'in', direction: 'in', side: 'left' },
          { id: 'yes', direction: 'out', side: 'right', label: yes },
          { id: 'no', direction: 'out', side: 'bottom', label: '驳回' },
        ],
      }, nodes.nodeTypes![2]!],
    })
    const designer = await mount(d => d.extensions = [branching('同意')])
    const label = (port: string): string | undefined => portElement(designer, 't', port).querySelector('[data-part="port-label"]')?.textContent ?? undefined
    expect(['in', 'yes', 'no'].map(port => [portElement(designer, 't', port).dataset.side, label(port)])).toEqual([
      ['left', undefined],
      ['right', '同意'],
      ['bottom', '驳回'],
    ])
    designer.extensions = [branching()]
    await designer.updateComplete
    expect(label('yes')).toBeUndefined()
    expect(label('no')).toBe('驳回')
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
    const designer = await mount(element => element.settings = { 'flow.snap': false })
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

  it('按住 Alt 拖动节点松手时复制一份到落点，原节点不动，记为一步', async () => {
    const designer = await mount((element) => {
      element.grid = false
      element.settings = { 'flow.snap': false }
    })
    press(nodeElement(designer, 't'), 210, 10)
    move(250, 70, { altKey: true })
    release(250, 70, { altKey: true })
    expect(designer.schema.nodes.find(node => node.id === 't')).toMatchObject({ x: 200, y: 0 })
    const copy = designer.schema.nodes.at(-1)!
    expect([copy.id, copy.type, copy.x, copy.y]).toEqual(['task_1', 'task', 240, 60])
    expect(designer.getSelection().nodes).toEqual(['task_1'])
    designer.undo()
    expect(designer.schema).toEqual(sample())
  })

  it('移动时对齐其余节点，对齐线由覆盖层画出，松手后收起', async () => {
    const designer = await mount(element => element.grid = false)
    const overlay = designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-transform')!
    press(nodeElement(designer, 's'), 10, 10)
    move(40, 13)
    await overlay.updateComplete
    expect(designer.schema.nodes[0]).toMatchObject({ x: 30, y: 0 })
    expect(overlay.querySelectorAll('[data-part="guide"]').length).toBeGreaterThan(0)
    release(40, 13)
    await overlay.updateComplete
    expect(overlay.querySelectorAll('[data-part="guide"]')).toHaveLength(0)
  })

  it('覆盖层拖到画布边缘时请求平移，视口跟着移', async () => {
    const designer = await mount()
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    const overlay = designer.querySelector('xh-designer-transform')!
    overlay.dispatchEvent(new CustomEvent('pan-request', { detail: { dx: 8, dy: 0 }, bubbles: true }))
    expect(designer.getViewport()).toEqual({ x: -8, y: 0, zoom: 1 })
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

  it('视口变了之后覆盖层的选中框跟着缩放与平移', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    const overlay = designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-transform')!
    designer.setViewport({ x: 10, y: 20, zoom: 2 })
    await overlay.updateComplete
    const frame = overlay.querySelector<HTMLElement>('[data-part="frame"]')!
    expect(frame.style.inlineSize).toBe('200px')
    expect(frame.style.transform).toContain('translate(410px, 20px)')
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
    focusCanvas(designer)
    expect(key(designer, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(false)
    const data = clipboardData()
    expect(clip('copy', data).defaultPrevented).toBe(true)
    expect(key(designer, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(clip('paste', data).defaultPrevented).toBe(true)
    expect(designer.schema.nodes.at(-1)).toMatchObject({ id: 'start_1', x: 16, y: 16 })
    key(designer, { key: 'ArrowRight' })
    key(designer, { key: 'ArrowRight', shiftKey: true })
    expect(designer.schema.nodes.at(-1)).toMatchObject({ x: 33, y: 16 })
    const saves: unknown[] = []
    designer.addEventListener('save', () => saves.push(1))
    expect(key(designer, { key: 's', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(saves).toHaveLength(1)
  })

  it('系统剪贴板：画布有焦点时复制写进事件数据，粘贴读出流程内容，跨实例可贴', async () => {
    const source = await mount()
    const target = await mount(element => element.schema = { version: 1, nodes: [], edges: [] })
    source.select({ nodes: ['s', 't'] })
    const data = clipboardData()
    expect(clip('copy', data).defaultPrevented).toBe(false)
    focusCanvas(source)
    expect(clip('copy', data).defaultPrevented).toBe(true)
    const text = data.store.get('application/x-xihan-flow+json')!
    expect(data.store.get('text/plain')).toBe(text)
    expect(decodeFlowClipboard(text)).toEqual({ nodes: sample().nodes.slice(0, 2), edges: sample().edges })

    focusCanvas(target)
    clip('paste', data)
    clip('paste', data)
    expect(target.schema.nodes.map(node => [node.id, node.x, node.y])).toEqual([
      ['start_1', 16, 16],
      ['task_1', 216, 16],
      ['start_2', 32, 32],
      ['task_2', 232, 32],
    ])
    expect(target.schema.edges.map(edge => [edge.source.node, edge.target.node])).toEqual([['start_1', 'task_1'], ['start_2', 'task_2']])
    expect(target.getSelection()).toEqual({ nodes: ['start_2', 'task_2'], edges: ['edge_2'] })
  })

  it('paste(clip, { at }) 把内容整体的中心放到 at、左上角吸附网格，不累加偏移；剪贴板是空的或只读时返回空选择', async () => {
    const designer = await mount(element => element.schema = { version: 1, nodes: [], edges: [] })
    expect(designer.paste(undefined, { at: { x: 0, y: 0 } })).toEqual({ nodes: [], edges: [] })
    const content = { nodes: sample().nodes.slice(0, 2), edges: sample().edges }
    expect(designer.paste(content, { at: { x: 502, y: 314 } })).toEqual({ nodes: ['start_1', 'task_1'], edges: ['edge_1'] })
    designer.paste(undefined, { at: { x: 502, y: 314 } })
    expect(designer.schema.nodes.map(node => [node.id, node.x, node.y])).toEqual([
      ['start_1', 352, 288],
      ['task_1', 552, 288],
      ['start_2', 352, 288],
      ['task_2', 552, 288],
    ])
    expect(designer.getSelection()).toEqual({ nodes: ['start_2', 'task_2'], edges: ['edge_2'] })
    designer.readonly = true
    expect(designer.paste(content, { at: { x: 0, y: 0 } })).toEqual({ nodes: [], edges: [] })
    expect(designer.schema.nodes).toHaveLength(4)
  })

  it('runCommand(id) 执行此刻可用的命令（内置的或扩展的）并返回 true；命令不存在或不可用时返回 false', async () => {
    const run = vi.fn()
    const designer = await mount(element => element.extensions = [nodes, { id: 'acme', commands: [{ id: 'acme.run', label: 'Run', run }] }])
    expect(designer.runCommand('delete')).toBe(false)
    designer.select({ nodes: ['t'] })
    expect(designer.runCommand('delete')).toBe(true)
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 'e'])
    expect(designer.runCommand('undo')).toBe(true)
    expect(designer.schema).toEqual(sample())
    expect(designer.runCommand('acme.run')).toBe(true)
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ designer }))
    expect(designer.runCommand('acme.missing')).toBe(false)
  })

  it('只有 text/plain 也能粘贴；别的内容、结构不合法或焦点不在画布上时不处理', async () => {
    const designer = await mount(element => element.schema = { version: 1, nodes: [], edges: [] })
    const text = encodeFlowClipboard({ nodes: [sample().nodes[0]!], edges: [] })
    focusCanvas(designer)
    expect(clip('paste', clipboardData({ 'text/plain': 'hello' })).defaultPrevented).toBe(false)
    expect(clip('paste', clipboardData({ 'text/plain': text.replace('"start"', '1') })).defaultPrevented).toBe(false)
    expect(designer.schema.nodes).toEqual([])
    expect(clip('paste', clipboardData({ 'text/plain': text })).defaultPrevented).toBe(true)
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['start_1'])

    const input = window.document.createElement('input')
    window.document.body.append(input)
    input.focus()
    expect(clip('paste', clipboardData({ 'text/plain': text })).defaultPrevented).toBe(false)
    expect(designer.schema.nodes).toHaveLength(1)
    input.remove()
  })

  it('剪切写进剪贴板并删除选中内容，记为一步；只读时剪切与粘贴都不处理', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    focusCanvas(designer)
    const data = clipboardData()
    expect(clip('cut', data).defaultPrevented).toBe(true)
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 'e'])
    expect(designer.schema.edges).toEqual([])
    expect(decodeFlowClipboard(data.store.get('text/plain')!)!.nodes.map(node => node.id)).toEqual(['t'])
    designer.undo()
    expect(designer.schema).toEqual(sample())

    designer.readonly = true
    await designer.updateComplete
    designer.select({ nodes: ['t'] })
    expect(clip('cut', clipboardData()).defaultPrevented).toBe(false)
    expect(clip('paste', data).defaultPrevented).toBe(false)
    expect(designer.cut()).toBeUndefined()
    expect(designer.schema).toEqual(sample())
    expect(clip('copy', clipboardData()).defaultPrevented).toBe(true)
  })

  it('copy() 与 cut() 同时写进系统剪贴板的 text/plain', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    const navigator = window.document.defaultView!.navigator
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      const designer = await mount()
      designer.select({ nodes: ['s'] })
      expect(designer.copy()!.nodes.map(node => node.id)).toEqual(['s'])
      expect(designer.cut()!.nodes.map(node => node.id)).toEqual(['s'])
      expect(designer.schema.nodes.map(node => node.id)).toEqual(['t', 'e'])
      expect(writeText).toHaveBeenCalledTimes(2)
      expect(decodeFlowClipboard(writeText.mock.calls[1]![0])!.nodes.map(node => node.id)).toEqual(['s'])
      designer.select({ nodes: [] })
      expect(designer.copy()).toBeUndefined()
      expect(writeText).toHaveBeenCalledTimes(2)
    }
    finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('readonly attribute 三态：不写为缺省，写 "false" 为 false，空串与 "true" 为 true，摘掉回到缺省', async () => {
    const designer = await mount()
    const state = (): [boolean | undefined, boolean] => [designer.readonly, designer.hasAttribute('data-readonly')]
    expect(state()).toEqual([undefined, false])
    for (const [value, expected] of [['', true], ['false', false], ['true', true], ['readonly', true]] as const) {
      designer.setAttribute('readonly', value)
      await designer.updateComplete
      expect([value, ...state()]).toEqual([value, expected, expected])
    }
    designer.setAttribute('readonly', 'false')
    await designer.updateComplete
    expect(designer.deleteSelection()).toBe(false)
    designer.select({ nodes: ['t'] })
    expect(designer.deleteSelection()).toBe(true)
    designer.removeAttribute('readonly')
    await designer.updateComplete
    expect(state()).toEqual([undefined, false])
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
