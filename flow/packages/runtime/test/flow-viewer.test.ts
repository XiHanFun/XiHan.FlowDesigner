/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDocument } from '@xihan-flow/core'
import type { XhFlowViewer } from '../src'
import { createNodeTypeRegistry } from '@xihan-flow/core'
import { setXhConfig } from '@xihan-ui/web-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlowViewer, FLOW_VIEWER_TAG } from '../src'

defineFlowViewer()

const registry = createNodeTypeRegistry([
  { type: 'start', label: '开始', size: { width: 100, height: 40 }, ports: 'out' },
  { type: 'task', label: '任务', size: { width: 100, height: 40 }, ports: 'both' },
])

const document: FlowDocument = {
  version: 1,
  nodes: [
    { id: 's', type: 'start', x: 0, y: 0, width: 100, height: 40 },
    { id: 't', type: 'task', x: 200, y: 0, width: 100, height: 40, label: '审批' },
  ],
  edges: [
    { id: 'st', source: { node: 's' }, target: { node: 't' }, label: '提交', style: { dashed: true } },
  ],
}

const mounted: Element[] = []

async function mount(setup: (viewer: XhFlowViewer) => void = () => {}): Promise<XhFlowViewer> {
  const viewer = window.document.createElement(FLOW_VIEWER_TAG)
  viewer.nodeTypes = registry
  viewer.document = document
  setup(viewer)
  window.document.body.append(viewer)
  mounted.push(viewer)
  await viewer.updateComplete
  return viewer
}

function part(viewer: Element, name: string): Element[] {
  return Array.from(viewer.querySelectorAll(`[data-part="${name}"]`))
}

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove()
  setXhConfig({})
})

describe('<xh-flow-viewer>', () => {
  it('重复注册不报错', () => {
    expect(() => defineFlowViewer()).not.toThrow()
    expect(customElements.get(FLOW_VIEWER_TAG)).toBeDefined()
  })

  it('画出节点、连线、箭头与标签', async () => {
    const viewer = await mount()
    const nodes = part(viewer, 'node') as HTMLElement[]
    expect(nodes.map(node => [node.dataset.nodeId, node.dataset.nodeType, node.textContent])).toEqual([['s', 'start', '开始'], ['t', 'task', '审批']])
    expect([nodes[1]!.style.left, nodes[1]!.style.width]).toEqual(['200px', '100px'])
    const edge = part(viewer, 'edge')[0]!
    expect(edge.getAttribute('data-edge-id')).toBe('st')
    expect(edge.hasAttribute('data-dashed')).toBe(true)
    expect(part(viewer, 'edge-line')[0]!.getAttribute('d')).toMatch(/^M100,20/)
    expect(part(viewer, 'edge-arrow')[0]!.getAttribute('d')).toMatch(/^M200,20/)
    const label = part(viewer, 'edge-label')[0] as HTMLElement
    expect([label.textContent, label.style.left, label.style.top]).toEqual(['提交', '150px', '20px'])
  })

  it('运行状态与高亮写成数据属性，方法与属性同效', async () => {
    const viewer = await mount(element => (element.statuses = { s: 'completed' }))
    const node = (id: string): HTMLElement => viewer.querySelector(`[data-node-id="${id}"]`)!
    expect(node('s').dataset.status).toBe('completed')
    viewer.setNodeStatus('t', 'running')
    viewer.highlightNodes(['t'])
    await viewer.updateComplete
    expect([node('t').dataset.status, node('t').hasAttribute('data-highlighted')]).toEqual(['running', true])
    viewer.setNodeStatuses({ s: null })
    viewer.clearHighlights()
    await viewer.updateComplete
    expect([node('s').dataset.status, node('t').hasAttribute('data-highlighted')]).toEqual([undefined, false])
    expect(node('t').dataset.status).toBe('running')
  })

  it('自定义节点内容', async () => {
    const render = vi.fn((container: HTMLElement, context: { label: string, status: string | undefined }) => {
      container.textContent = `${context.label}:${context.status ?? '-'}`
    })
    const viewer = await mount((element) => {
      element.renderNode = render
      element.statuses = { t: 'waiting' }
    })
    expect((part(viewer, 'node') as HTMLElement[]).map(node => node.textContent)).toEqual(['开始:-', '审批:waiting'])
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('点击节点、连线与空白处派发对应事件', async () => {
    const viewer = await mount()
    const seen: string[] = []
    for (const type of ['node-click', 'edge-click', 'blank-click'])
      viewer.addEventListener(type, event => seen.push(`${type}:${JSON.stringify((event as CustomEvent).detail)}`))
    ;(viewer.querySelector('[data-node-id="t"]') as HTMLElement).click()
    part(viewer, 'edge-hit')[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ;(part(viewer, 'viewport')[0] as HTMLElement).click()
    expect(seen).toEqual(['node-click:{"id":"t"}', 'edge-click:{"id":"st"}', 'blank-click:{}'])
  })

  it('右键事件被宿主取消时拦下浏览器菜单', async () => {
    const viewer = await mount()
    viewer.addEventListener('node-contextmenu', event => event.preventDefault())
    const native = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 6 })
    viewer.querySelector('[data-node-id="s"]')!.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(true)
    const blank = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    part(viewer, 'viewport')[0]!.dispatchEvent(blank)
    expect(blank.defaultPrevented).toBe(false)
  })

  it('视口：设置后写进变换并派发 viewport-change，滚轮与方向键平移，Ctrl + 滚轮缩放', async () => {
    const viewer = await mount()
    const changes: unknown[] = []
    viewer.addEventListener('viewport-change', event => changes.push((event as CustomEvent).detail.viewport))
    const world = part(viewer, 'world')[0] as HTMLElement
    viewer.setViewport({ x: 10, y: 20, zoom: 2 })
    expect(world.style.transform).toBe('translate(10px, 20px) scale(2)')
    const root = part(viewer, 'viewport')[0]!
    root.dispatchEvent(new WheelEvent('wheel', { deltaX: 5, deltaY: 7, bubbles: true, cancelable: true }))
    expect(viewer.getViewport()).toEqual({ x: 5, y: 13, zoom: 2 })
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(viewer.getViewport().x).toBe(53)
    root.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }))
    expect(viewer.getViewport().zoom).toBeGreaterThan(2)
    expect(changes).toHaveLength(4)
  })

  it('有尺寸时适配视口、居中节点与按需显露', async () => {
    const viewer = await mount()
    const root = part(viewer, 'viewport')[0] as HTMLElement
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 400 })
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 200 })
    viewer.zoomToFit()
    expect(viewer.getViewport().zoom).toBe(1)
    viewer.scrollToNode('t')
    expect(viewer.getViewport()).toEqual({ x: -50, y: 80, zoom: 1 })
    const before = viewer.getViewport()
    viewer.revealNode('t')
    expect(viewer.getViewport()).toBe(before)
    viewer.zoomIn()
    expect(viewer.getViewport().zoom).toBeCloseTo(1.2)
    viewer.zoomToActual()
    expect(viewer.getViewport().zoom).toBe(1)
  })

  it('文案按 defaults < 全局配置 < 元素自己的顺序取', async () => {
    const viewer = await mount()
    const root = part(viewer, 'viewport')[0]!
    expect(root.getAttribute('aria-label')).toBe('Flow diagram')
    setXhConfig({ translations: { 'xh-flow-viewer': { label: '流程图' } } as never })
    await viewer.updateComplete
    expect(root.getAttribute('aria-label')).toBe('流程图')
    viewer.translations = { label: '审批流程' }
    await viewer.updateComplete
    expect(root.getAttribute('aria-label')).toBe('审批流程')
  })

  it('换节点类型或文档后重新计算', async () => {
    const viewer = await mount()
    viewer.document = { ...document, nodes: document.nodes.slice(0, 1), edges: [] }
    await viewer.updateComplete
    expect(part(viewer, 'node')).toHaveLength(1)
    expect(part(viewer, 'edge')).toHaveLength(0)
    expect(part(viewer, 'edge-label')).toHaveLength(0)
  })
})
