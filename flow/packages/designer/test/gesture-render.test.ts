/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

// 手势中只重画画布与状态栏：拖动节点的过程中不校验、不派发 issues-change，小地图与面板不刷新，松手后整份刷新一次；
// 有 ResizeObserver 时画布尺寸取它量出的值，滚轮缩放时不再读布局。

import type { XhDesignerMinimapElement } from '@xihan-ui/designer-shell'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, move, part, press, release, sample, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  vi.unstubAllGlobals()
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve))
}

describe('手势中只重画画布', () => {
  it('拖动节点时不校验、不派发 issues-change，小地图不换图形，状态栏照常显示位置；松手后各刷新一次', async () => {
    const designer = await mount(element => element.settings = { 'flow.snap': false })
    await flush()
    const issues: unknown[] = []
    designer.addEventListener('issues-change', event => issues.push(event))
    const minimap = designer.querySelector<XhDesignerMinimapElement>('xh-designer-minimap')!
    const before = minimap.shapes
    press(designer.querySelector('[data-part="node"][data-node-id="t"]')!, 210, 10)
    move(240, 30)
    move(260, 50)
    await designer.updateComplete
    await flush()
    const moved = designer.schema.nodes.find(node => node.id === 't')!
    expect(moved.x).not.toBe(200)
    expect([issues.length, minimap.shapes === before]).toEqual([0, true])
    // 状态栏照常跟着拖动显示位置
    expect(designer.querySelector('[data-part="status-item"]')!.textContent).toContain(String(Math.round(moved.x)))
    release(260, 50)
    await designer.updateComplete
    await flush()
    expect([issues.length, minimap.shapes === before]).toEqual([1, false])
  })
})

describe('拖动中的连线路由', () => {
  it('拖动节点时只给与它相连的连线重新路由，其余沿用上一帧的走线；松手后全部重新路由', async () => {
    const calls: string[] = []
    const designer = await mount((element) => {
      element.settings = { 'flow.snap': false }
      element.schema = { ...sample(), edges: [...sample().edges, { id: 'te', source: { node: 't' }, target: { node: 'e' } }] }
      element.router = (request) => {
        calls.push(request.edge.id)
        return [request.source.point, request.target.point]
      }
    })
    calls.length = 0
    press(designer.querySelector('[data-part="node"][data-node-id="s"]')!, 10, 10)
    move(40, 30)
    move(60, 50)
    await designer.updateComplete
    expect(designer.schema.nodes.find(node => node.id === 's')!.x).not.toBe(0)
    expect([...new Set(calls)]).toEqual(['st'])
    calls.length = 0
    release(60, 50)
    await designer.updateComplete
    expect(calls.sort()).toEqual(['st', 'te'])
  })
})

describe('缩放比例', () => {
  it('只写在端口层与控制柄层上，不写在整个世界层上：改缩放不让节点与连线跟着重算样式', async () => {
    const designer = await mount()
    designer.setViewport({ x: 0, y: 0, zoom: 2 })
    const zoomOf = (name: string): string => part(designer, name)[0]!.style.getPropertyValue('--xh-flow-designer-zoom')
    expect(['world', 'ports', 'handles'].map(zoomOf)).toEqual(['', '2', '2'])
  })
})

describe('画布尺寸', () => {
  it('有 ResizeObserver 时取它量出的尺寸：滚轮缩放不再读画布的 clientWidth / clientHeight', async () => {
    const observers: { callback: ResizeObserverCallback, targets: Element[] }[] = []
    vi.stubGlobal('ResizeObserver', class {
      readonly #record: { callback: ResizeObserverCallback, targets: Element[] }
      constructor(callback: ResizeObserverCallback) {
        this.#record = { callback, targets: [] }
        observers.push(this.#record)
      }

      observe(target: Element): void {
        this.#record.targets.push(target)
      }

      unobserve(target: Element): void {
        this.#record.targets = this.#record.targets.filter(item => item !== target)
      }

      disconnect(): void {
        this.#record.targets = []
      }
    })
    const designer = await mount()
    const root = part(designer, 'viewport')[0]!
    let reads = 0
    for (const [name, value] of [['clientWidth', 600], ['clientHeight', 300]] as const) {
      Object.defineProperty(root, name, {
        configurable: true,
        get: () => {
          reads++
          return value
        },
      })
    }
    root.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 300, width: 600, height: 300, toJSON: () => ({}) })
    // 照真实的接口回调：每个观察器带上它盯着的那些节点此刻的尺寸
    for (const { callback, targets } of observers) {
      if (targets.length > 0)
        callback(targets.map(target => ({ target, contentRect: target.getBoundingClientRect(), borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }) as unknown as ResizeObserverEntry), {} as ResizeObserver)
    }
    reads = 0
    const zoom = designer.getViewport().zoom
    for (let i = 0; i < 5; i++)
      root.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: 300, clientY: 150, bubbles: true, cancelable: true }))
    expect(designer.getViewport().zoom).toBeGreaterThan(zoom)
    expect(reads).toBe(0)
  })
})
