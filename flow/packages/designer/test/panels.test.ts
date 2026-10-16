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

  it('panels 里没列工具栏时收起，文案跟着全局配置变', async () => {
    const designer = await mount(element => element.setAttribute('panels', 'palette properties'))
    expect(part(designer, 'toolbar')[0]!.hidden).toBe(true)
    expect(part(designer, 'palette')[0]!.hidden).toBe(false)
    expect(part(designer, 'issues')[0]!.hidden).toBe(true)
    designer.removeAttribute('panels')
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

  it('只读时条目禁用，panels 里没列物料时收起', async () => {
    const designer = await mount(element => element.readonly = true)
    expect(part(designer, 'palette-item').every(item => (item as HTMLButtonElement).disabled)).toBe(true)
    designer.panels = 'toolbar  properties\tissues minimap'
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

  function list(designer: Element): HTMLElement & { updateComplete: Promise<unknown> } {
    return designer.querySelector('xh-designer-issues')!
  }

  async function settle(designer: XhFlowDesigner): Promise<void> {
    for (let round = 0; round < 3; round++) {
      await designer.updateComplete
      await list(designer).updateComplete
      await Promise.resolve()
    }
  }

  function rows(designer: Element): HTMLElement[] {
    return Array.from(list(designer).querySelectorAll<HTMLElement>('[data-part="issue"]'))
  }

  it('列出问题与错误、警告数，错误在前；落在属性上的带属性名，节点上标出最严重的一级', async () => {
    const designer = await mount(element => element.nodeTypes = typed)
    await settle(designer)
    expect(rows(designer).map(item => [item.tagName, item.dataset.severity, item.querySelector('[data-part="issue-subject"]')!.textContent, item.querySelector('[data-part="issue-message"]')!.textContent])).toEqual([
      ['DIV', 'error', 'Flow', 'At least 1 single required, found 0'],
      ['BUTTON', 'error', '任务', '负责人: Required'],
      ['BUTTON', 'warning', '任务', 'No outgoing connection'],
      ['BUTTON', 'warning', '结束', 'Not connected'],
    ])
    const filter = list(designer).querySelector('[data-part="filter"]')!
    expect(filter.querySelector('button[value="error"]')!.textContent).toBe('2 errors')
    expect(filter.querySelector('button[value="warning"]')!.textContent).toBe('2 warnings')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="t"]')!.dataset.issue).toBe('error')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="e"]')!.dataset.issue).toBe('warning')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="s"]')!.dataset.issue).toBeUndefined()
  })

  it('点问题选中并显露所在节点，落在属性上时把焦点交给那个字段', async () => {
    const designer = await mount(element => element.nodeTypes = typed)
    placeCanvas(designer, 200, 100)
    designer.setViewport({ x: -1000, y: -1000, zoom: 1 })
    await settle(designer)
    const owner = rows(designer).find(item => item.textContent!.includes('负责人'))!
    owner.click()
    expect(designer.getSelection()).toEqual({ nodes: ['t'], edges: [] })
    expect(designer.getViewport()).not.toEqual({ x: -1000, y: -1000, zoom: 1 })
    await settle(designer)
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-properties')!.updateComplete
    await Promise.resolve()
    expect(document.activeElement).toBe(designer.querySelector('[data-part="property"][data-path="data.owner"] input'))
  })

  it('没有问题时给提示，panels 写空串时全部收起', async () => {
    const designer = await mount((element) => {
      element.validateOptions = { severity: { 'node.isolated': 'off', 'node.missing-outgoing': 'off', 'node.missing-incoming': 'off' } }
    })
    await settle(designer)
    expect(rows(designer)).toHaveLength(0)
    const empty = list(designer).querySelector<HTMLElement>('[data-part="empty"]')!
    expect([empty.hidden, empty.textContent]).toEqual([false, 'No problems'])
    designer.panels = ''
    await designer.updateComplete
    expect(['toolbar', 'palette', 'properties', 'issues', 'minimap'].map(name => part(designer, name)[0]!.hidden)).toEqual([true, true, true, true, true])
  })
})

describe('小地图', () => {
  function sizeMinimap(designer: XhFlowDesigner, width: number, height: number): HTMLElement & { updateComplete: Promise<unknown> } {
    const minimap = designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-minimap')!
    Object.defineProperty(minimap, 'clientWidth', { configurable: true, value: width })
    Object.defineProperty(minimap, 'clientHeight', { configurable: true, value: height })
    minimap.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) })
    return minimap
  }

  it('按比例画出节点、连线与视口框，视口变化时视口框跟着走', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 300)
    const minimap = sizeMinimap(designer, 150, 100)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    await minimap.updateComplete
    expect(minimap.querySelectorAll('rect[data-part="rect"]')).toHaveLength(3)
    expect(minimap.querySelectorAll('path[data-part="path"]')).toHaveLength(1)
    const frame = minimap.querySelector('rect[data-part="frame"]')!
    const box = (): number[] => ['x', 'y', 'width', 'height'].map(name => Number(frame.getAttribute(name)))
    expect(box().map(value => Math.round(value * 10) / 10)).toEqual([6, 15.5, 138, 69])
    designer.setViewport({ x: -300, y: 0, zoom: 1 })
    await minimap.updateComplete
    expect(box()[0]).toBeGreaterThan(6)
  })

  it('在小地图上按下即把视口中心移过去，拖动时跟着走', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 300)
    const minimap = sizeMinimap(designer, 150, 100)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    await minimap.updateComplete
    press(minimap, 40, 30)
    expect(designer.getViewport().x).toBeCloseTo(300 - 34 / 0.23)
    expect(designer.getViewport().y).toBeCloseTo(150 - 14.5 / 0.23)
    move(75, 50)
    expect(designer.getViewport().x).toBeCloseTo(0)
    release(75, 50)
  })

  it('没有节点时收起，panels 里没列小地图时也收起', async () => {
    const designer = await mount(element => element.schema = { version: 1, nodes: [], edges: [] })
    const minimap = designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-minimap')!
    await minimap.updateComplete
    expect(minimap.hasAttribute('data-empty')).toBe(true)
    designer.schema = { version: 1, nodes: [{ id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40 }], edges: [] }
    await designer.updateComplete
    await minimap.updateComplete
    expect([minimap.hasAttribute('data-empty'), minimap.hidden]).toEqual([false, false])
    designer.panels = 'toolbar palette'
    await designer.updateComplete
    expect(minimap.hidden).toBe(true)
  })
})

describe('右键菜单', () => {
  function rightClick(target: Element, x = 10, y = 10): MouseEvent {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })
    target.dispatchEvent(event)
    return event
  }

  // 菜单打开后内容会搬进浮层落点，挂载时先记下内容节点
  let content: HTMLElement

  async function mountMenu(setup?: (designer: XhFlowDesigner) => void): Promise<XhFlowDesigner> {
    const designer = await mount(setup)
    content = designer.querySelector<HTMLElement>('xh-context-menu [data-xh-part="content"]')!
    return designer
  }

  function items(): string[] {
    return Array.from(content.querySelectorAll<HTMLElement>('[data-xh-part="item"]'))
      .map(item => `${item.getAttribute('value')}${item.getAttribute('aria-disabled') === 'true' ? '(x)' : ''}`)
  }

  function menuRoot(designer: Element): HTMLElement {
    return designer.querySelector<HTMLElement>('[data-flow-menu-root]')!
  }

  it('右键节点、连线与空白处换上对应条目，多选节点时加上对齐与分布', async () => {
    const designer = await mountMenu()
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    await designer.updateComplete
    expect(designer.getSelection().nodes).toEqual(['t'])
    expect(items()).toEqual(['duplicate', 'copy', 'cut', 'delete'])

    designer.select({ nodes: ['s', 't', 'e'] })
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    expect(items()).toEqual(['duplicate', 'copy', 'cut', 'delete', 'align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'distribute-horizontal', 'distribute-vertical'])

    rightClick(part(designer, 'edge-hit')[0]!)
    expect(items()).toEqual(['delete', 'clear-vertices(x)'])

    rightClick(part(designer, 'viewport')[0]!, 600, 600)
    expect(items()).toEqual(['paste(x)', 'select-all', 'auto-layout', 'zoom-to-fit'])
  })

  it('选中条目执行命令，禁用的条目不执行', async () => {
    const designer = await mountMenu()
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    const menu = designer.querySelector('xh-context-menu')!
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'copy' } }))
    rightClick(part(designer, 'viewport')[0]!, 600, 600)
    expect(items()[0]).toBe('paste')
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'paste' } }))
    expect(designer.schema.nodes).toHaveLength(4)

    designer.readonly = true
    await designer.updateComplete
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    expect(items()).toEqual(['duplicate(x)', 'copy', 'cut(x)', 'delete(x)'])
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'delete' } }))
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'cut' } }))
    expect(designer.schema.nodes).toHaveLength(4)

    designer.readonly = false
    await designer.updateComplete
    designer.select({ nodes: ['t'] })
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'cut' } }))
    expect(designer.schema.nodes.map(node => node.id)).not.toContain('t')
  })

  it('宿主取消 *-contextmenu 时不弹内置菜单，也拦下浏览器菜单', async () => {
    const designer = await mountMenu()
    designer.addEventListener('node-contextmenu', event => event.preventDefault())
    const event = rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    await designer.updateComplete
    expect(event.defaultPrevented).toBe(true)
    expect(menuRoot(designer).dataset.state).not.toBe('open')
    const blank = rightClick(part(designer, 'viewport')[0]!, 600, 600)
    await designer.updateComplete
    expect(blank.defaultPrevented).toBe(true)
    expect(menuRoot(designer).dataset.state).toBe('open')
  })

  it('画布的焦点与可访问名在触发区上，Shift+F10 按当前选择换条目', async () => {
    const designer = await mountMenu()
    const trigger = designer.querySelector<HTMLElement>('[data-flow-canvas]')!
    expect([trigger.getAttribute('role'), trigger.getAttribute('aria-label'), trigger.tabIndex]).toEqual(['region', 'Flow designer', 0])
    expect(part(designer, 'viewport')[0]!.hasAttribute('tabindex')).toBe(false)
    designer.select({ edges: ['st'] })
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }))
    expect(items()).toEqual(['delete', 'clear-vertices(x)'])
  })
})

describe('连线编辑', () => {
  function handle(designer: Element, part: string, key?: string): HTMLElement {
    const all = Array.from(designer.querySelectorAll<HTMLElement>(`[data-part="${part}"]`))
    return key === undefined ? all[0]! : all.find(item => item.dataset.end === key || item.dataset.index === key)!
  }

  it('选中一条连线时画出端点柄与加点柄，多选、只读时不画', async () => {
    const designer = await mount()
    designer.select({ edges: ['st'] })
    await designer.updateComplete
    expect(part(designer, 'edge-handle').map(item => [item.dataset.end, item.style.left, item.style.top])).toEqual([['source', '100px', '20px'], ['target', '200px', '20px']])
    expect(part(designer, 'segment-handle')).toHaveLength(1)
    designer.select({ nodes: ['s'], edges: ['st'] })
    await designer.updateComplete
    expect(part(designer, 'edge-handle')).toHaveLength(0)
    designer.select({ edges: ['st'] })
    designer.readonly = true
    await designer.updateComplete
    expect(part(designer, 'edge-handle')).toHaveLength(0)
  })

  it('拖终点柄改连到别的节点，违反约束时派发 connect-reject 且不改', async () => {
    const designer = await mount()
    const rejects: unknown[] = []
    designer.addEventListener('connect-reject', event => rejects.push((event as CustomEvent).detail))
    designer.select({ edges: ['st'] })
    await designer.updateComplete
    press(handle(designer, 'edge-handle', 'target'), 200, 20)
    move(300, 120)
    move(400, 220)
    await designer.updateComplete
    expect(part(designer, 'connect-preview')[0]!.getAttribute('data-valid')).toBe('true')
    release(400, 220)
    expect(designer.schema.edges[0]!.target).toEqual({ node: 'e', port: 'in' })

    await designer.updateComplete
    press(handle(designer, 'edge-handle', 'target'), 400, 220)
    move(300, 120)
    move(100, 20)
    release(100, 20)
    expect(designer.schema.edges[0]!.target).toEqual({ node: 'e', port: 'in' })
    expect(rejects).toHaveLength(1)
    designer.undo()
    expect(designer.schema.edges[0]!.target).toEqual({ node: 't' })
  })

  it('拖加点柄加一个拐点、拖拐点挪动，各记一步撤销；双击拐点与「清除拐点」交回路由', async () => {
    const designer = await mount()
    designer.select({ edges: ['st'] })
    await designer.updateComplete
    press(handle(designer, 'segment-handle'), 150, 20)
    move(150, 50)
    move(150, 80)
    release(150, 80)
    expect(designer.schema.edges[0]!.vertices).toEqual([{ x: 144, y: 80 }])
    await designer.updateComplete
    press(handle(designer, 'vertex-handle', '0'), 144, 80)
    move(160, 100)
    move(176, 112)
    release(176, 112)
    expect(designer.schema.edges[0]!.vertices).toEqual([{ x: 176, y: 112 }])
    designer.undo()
    expect(designer.schema.edges[0]!.vertices).toEqual([{ x: 144, y: 80 }])
    await designer.updateComplete
    handle(designer, 'vertex-handle', '0').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(designer.schema.edges[0]).not.toHaveProperty('vertices')

    designer.undo()
    await designer.updateComplete
    const menu = designer.querySelector('xh-context-menu')!
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'clear-vertices' } }))
    expect(designer.schema.edges[0]).not.toHaveProperty('vertices')
  })
})
