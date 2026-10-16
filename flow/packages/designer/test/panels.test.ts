/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { XhFlowDesigner } from '../src'
import { createNodeTypeRegistry } from '@xihan-flow/core'
import { setXhConfig } from '@xihan-ui/web-components'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner } from '../src'
import { definitions, mount, move, part, placeCanvas, press, release, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  setXhConfig({})
})

function toolbarItem(designer: Element, command: string): HTMLButtonElement {
  return designer.querySelector<HTMLButtonElement>(`[data-part="toolbar"] button[value="${command}"]`)!
}

describe('工具栏', () => {
  it('条目带文案，可用状态随历史、选择与只读变化', async () => {
    const designer = await mount()
    expect(designer.querySelector('xh-toolbar [data-xh-part="root"]')!.getAttribute('aria-label')).toBe('Designer tools')
    expect(toolbarItem(designer, 'undo').textContent).toBe('Undo')
    const disabled = (): string[] => ['undo', 'redo', 'delete', 'duplicate', 'align-left', 'distribute-horizontal', 'auto-layout', 'zoom-in']
      .filter(command => toolbarItem(designer, command).disabled)
    expect(disabled()).toEqual(['undo', 'redo', 'delete', 'duplicate', 'align-left', 'distribute-horizontal'])

    designer.select({ nodes: ['s', 't'] })
    await designer.updateComplete
    expect(disabled()).toEqual(['undo', 'redo', 'distribute-horizontal'])

    toolbarItem(designer, 'align-left').click()
    await designer.updateComplete
    expect(disabled()).toEqual(['redo', 'distribute-horizontal'])

    toolbarItem(designer, 'undo').click()
    await designer.updateComplete
    expect(disabled()).toEqual(['undo', 'distribute-horizontal'])

    designer.readonly = true
    await designer.updateComplete
    expect(disabled()).toEqual(['undo', 'redo', 'delete', 'duplicate', 'align-left', 'distribute-horizontal', 'auto-layout'])
  })

  it('点条目执行对应命令，禁用的条目不执行', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    toolbarItem(designer, 'delete').click()
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 'e'])
    await designer.updateComplete
    toolbarItem(designer, 'delete').click()
    expect(designer.schema.nodes).toHaveLength(2)
    placeCanvas(designer, 400, 200)
    toolbarItem(designer, 'zoom-in').click()
    expect(designer.getViewport().zoom).toBeCloseTo(1.2)
  })

  it('panels.toolbar 为 false 时收起，文案跟着全局配置变', async () => {
    const designer = await mount(element => element.panels = { toolbar: false })
    expect(part(designer, 'toolbar')[0]!.hidden).toBe(true)
    designer.panels = {}
    setXhConfig({ translations: { 'xh-flow-designer': { undo: '撤销' } } })
    await designer.updateComplete
    expect(part(designer, 'toolbar')[0]!.hidden).toBe(false)
    expect(toolbarItem(designer, 'undo').textContent).toBe('撤销')
  })
})

describe('物料面板', () => {
  it('按类别分组，没有类别的排最后', async () => {
    const designer = await mount()
    const groups = part(designer, 'palette-group').map(group => [
      group.querySelector('[data-part="palette-group-label"]')!.textContent,
      ...Array.from(group.querySelectorAll<HTMLElement>('[data-part="palette-item"]'), item => `${item.dataset.nodeType}:${item.textContent}`),
    ])
    expect(groups).toEqual([
      ['事件', 'start:开始', 'end:结束'],
      ['活动', 'task:任务'],
      ['Other', 'note:note'],
    ])
    const group = part(designer, 'palette-group')[0]!
    expect(group.getAttribute('aria-labelledby')).toBe(group.querySelector('[data-part="palette-group-label"]')!.id)

    designer.paletteGroupOrder = ['活动']
    designer.paletteGroupLabels = { 活动: '人工活动' }
    await designer.updateComplete
    expect(part(designer, 'palette-group-label').map(label => label.textContent)).toEqual(['人工活动', '事件', 'Other'])
  })

  it('点条目在视口中央新建节点并选中', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 400)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    designer.querySelector<HTMLButtonElement>('[data-node-type="task"]')!.click()
    const added = designer.schema.nodes.at(-1)!
    expect([added.type, added.x, added.y]).toEqual(['task', 256, 176])
    expect(designer.getSelection().nodes).toEqual([added.id])
  })

  it('拖进画布在松手处新建节点，拖动中显示落点；松手在画布外不新建', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 400)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    const item = designer.querySelector<HTMLButtonElement>('[data-node-type="task"]')!
    const preview = part(designer, 'drop-preview')[0]!

    press(item, 5, 5)
    move(-50, 300)
    await designer.updateComplete
    expect(item.hasAttribute('data-dragging')).toBe(true)
    expect(preview.hidden).toBe(true)
    move(310, 300)
    await designer.updateComplete
    expect(preview.hidden).toBe(false)
    expect([preview.style.left, preview.style.top]).toEqual(['256px', '288px'])
    release(310, 300)
    item.click()
    await designer.updateComplete
    expect(preview.hidden).toBe(true)
    expect(item.hasAttribute('data-dragging')).toBe(false)
    const added = designer.schema.nodes.at(-1)!
    expect([designer.schema.nodes.length, added.type, added.x, added.y]).toEqual([4, 'task', 256, 288])

    press(item, 5, 5)
    move(310, 300)
    move(-50, 300)
    release(-50, 300)
    expect(designer.schema.nodes).toHaveLength(4)
  })

  it('只读时条目禁用，panels.palette 为 false 时收起', async () => {
    const designer = await mount(element => element.readonly = true)
    expect(part(designer, 'palette-item').every(item => (item as HTMLButtonElement).disabled)).toBe(true)
    designer.panels = { palette: false }
    await designer.updateComplete
    expect(part(designer, 'palette')[0]!.hidden).toBe(true)
  })
})

describe('问题列表', () => {
  const typed = createNodeTypeRegistry([
    ...definitions.filter(definition => definition.type !== 'task'),
    { type: 'task', label: '任务', size: { width: 100, height: 40 }, ports: 'both', properties: [{ path: ['data', 'owner'], control: { kind: 'text' }, label: '负责人', required: true }] },
    { type: 'single', size: { width: 100, height: 40 }, ports: 'none', minCount: 1 },
  ])

  async function settle(designer: XhFlowDesigner): Promise<void> {
    await designer.updateComplete
    await Promise.resolve()
    await designer.updateComplete
  }

  it('列出问题与错误、警告数，落在属性上的带属性名，节点上标出最严重的一级', async () => {
    const designer = await mount(element => element.nodeTypes = typed)
    await settle(designer)
    const rows = part(designer, 'issue').map(item => [item.tagName, item.dataset.severity, item.querySelector('[data-part="issue-subject"]')!.textContent, item.querySelector('[data-part="issue-message"]')!.textContent])
    expect(rows).toEqual([
      ['DIV', 'error', 'Flow', 'At least 1 single required, found 0'],
      ['BUTTON', 'warning', '任务', 'No outgoing connection'],
      ['BUTTON', 'warning', '结束', 'Not connected'],
      ['BUTTON', 'error', '任务', '负责人: Required'],
    ])
    expect(part(designer, 'issues-danger')[0]!.textContent).toBe('2 errors')
    expect(part(designer, 'issues-warning')[0]!.textContent).toBe('2 warnings')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="t"]')!.dataset.issue).toBe('error')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="e"]')!.dataset.issue).toBe('warning')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="s"]')!.dataset.issue).toBeUndefined()
  })

  it('点问题选中并显露所在节点，落在属性上时把焦点交给那个字段', async () => {
    const designer = await mount(element => element.nodeTypes = typed)
    placeCanvas(designer, 200, 100)
    designer.setViewport({ x: -1000, y: -1000, zoom: 1 })
    await settle(designer)
    const owner = part(designer, 'issue').find(item => item.textContent!.includes('负责人'))!
    owner.click()
    expect(designer.getSelection()).toEqual({ nodes: ['t'], edges: [] })
    expect(designer.getViewport()).not.toEqual({ x: -1000, y: -1000, zoom: 1 })
    await settle(designer)
    expect(document.activeElement).toBe(designer.querySelector('[data-part="property"][data-path="data.owner"] input'))
  })

  it('没有问题时给提示，panels.issues 为 false 时收起', async () => {
    const designer = await mount((element) => {
      element.validateOptions = { severity: { 'node.isolated': 'off', 'node.missing-outgoing': 'off', 'node.missing-incoming': 'off' } }
    })
    await settle(designer)
    expect(part(designer, 'issue')).toHaveLength(0)
    expect(part(designer, 'issues-empty')[0]!.hidden).toBe(false)
    expect(part(designer, 'issues-danger')[0]!.hidden).toBe(true)
    designer.panels = { issues: false }
    await designer.updateComplete
    expect(part(designer, 'issues')[0]!.hidden).toBe(true)
  })
})

describe('小地图', () => {
  function sizeMinimap(designer: XhFlowDesigner, width: number, height: number): HTMLElement {
    const minimap = part(designer, 'minimap')[0]!
    Object.defineProperty(minimap, 'clientWidth', { configurable: true, value: width })
    Object.defineProperty(minimap, 'clientHeight', { configurable: true, value: height })
    minimap.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) })
    return minimap
  }

  it('按比例画出节点、连线与视口框，视口变化时视口框跟着走', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 300)
    sizeMinimap(designer, 150, 100)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    expect(part(designer, 'minimap-node')).toHaveLength(3)
    expect(part(designer, 'minimap-edge')).toHaveLength(1)
    const frame = part(designer, 'minimap-frame')[0]!
    const box = (): number[] => ['x', 'y', 'width', 'height'].map(name => Number(frame.getAttribute(name)))
    expect(box().map(value => Math.round(value * 10) / 10)).toEqual([6, 15.5, 138, 69])
    designer.setViewport({ x: -300, y: 0, zoom: 1 })
    expect(box()[0]).toBeGreaterThan(6)
  })

  it('在小地图上按下即把视口中心移过去，拖动时跟着走', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 300)
    const minimap = sizeMinimap(designer, 150, 100)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    press(minimap, 40, 30)
    expect(designer.getViewport().x).toBeCloseTo(300 - 34 / 0.23)
    expect(designer.getViewport().y).toBeCloseTo(150 - 14.5 / 0.23)
    move(75, 50)
    expect(designer.getViewport().x).toBeCloseTo(0)
    release(75, 50)
  })

  it('没有节点或 panels.minimap 为 false 时收起', async () => {
    const designer = await mount(element => element.schema = { version: 1, nodes: [], edges: [] })
    expect(part(designer, 'minimap')[0]!.hidden).toBe(true)
    designer.schema = { version: 1, nodes: [{ id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40 }], edges: [] }
    await designer.updateComplete
    expect(part(designer, 'minimap')[0]!.hidden).toBe(false)
    designer.panels = { minimap: false }
    await designer.updateComplete
    expect(part(designer, 'minimap')[0]!.hidden).toBe(true)
  })
})
