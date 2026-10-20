/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowNode, FlowPoint } from '@xihan-flow/core'
import type { FlowDesignerContext, FlowDesignerExtension, XhFlowDesigner } from '../src'
import { setXhConfig } from '@xihan-ui/web-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner, FLOW_DESIGNER_HELP_URL } from '../src'
import { definitions, mount, move, part, placeCanvas, press, release, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  setXhConfig({})
})

/** 设计器更新后外框再排一轮。 */
async function settleFrame(designer: XhFlowDesigner): Promise<void> {
  await designer.updateComplete
  await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-frame')!.updateComplete
}

/** 菜单栏的 <xh-menubar>：按数据铺的菜单与勾选。 */
type MenubarHost = HTMLElement & { collection?: { value: string, label?: string, items?: { value: string, children?: { value: string, kind?: string }[], checkboxValue?: string[] }[] }[], checkboxValue?: string[] }

/** 设计器的外框：面板都在它里面，JSON 编辑框的问题列表不在。 */
function frameOf(designer: Element): HTMLElement {
  return designer.querySelector<HTMLElement>('xh-designer-frame')!
}

function toolbarItem(designer: Element, command: string): HTMLButtonElement {
  return designer.querySelector<HTMLButtonElement>(`[data-part="command-bar"] button[value="${command}"]`)!
}

describe('工具栏', () => {
  it('条目带文案，可用状态随历史、选择与只读变化', async () => {
    const designer = await mount()
    expect(designer.querySelector('xh-toolbar [data-xh-part="root"]')!.getAttribute('aria-label')).toBe('Designer actions')
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

  it('内置命令都带图标，删除带 danger 语气；名字写在按钮上', async () => {
    const designer = await mount()
    const items = Array.from(designer.querySelectorAll<HTMLButtonElement>('[data-part="command-bar"] button[data-xh-part="item"]'))
    expect(items.length).toBeGreaterThan(10)
    expect(items.filter(item => !item.hasAttribute('data-icon')).map(item => item.value)).toEqual([])
    expect([toolbarItem(designer, 'delete').getAttribute('data-tone'), toolbarItem(designer, 'undo').getAttribute('data-tone')]).toEqual(['danger', null])
    expect(toolbarItem(designer, 'zoom-to-fit').getAttribute('aria-label')).toBe('Zoom to fit')
  })

  it('末组只留面板，设置与帮助只在菜单栏里（菜单栏常开，设置里写 toolbar.menubar 也不起作用）：设置打开设置对话框，帮助在新窗口打开文档站的设计器一页', async () => {
    const designer = await mount()
    const groups = (): string[][] => Array.from(designer.querySelectorAll('[data-part="command-bar"] [data-xh-part="group"]'), group => Array.from(group.querySelectorAll('button'), button => button.value))
    expect(groups().at(-1)).toEqual(['panels'])
    designer.settings = { 'toolbar.menubar': false }
    await settleFrame(designer)
    const regions = (frameOf(designer) as HTMLElement & { regions: readonly { name: string }[] }).regions.map(region => region.name)
    expect([groups().at(-1), regions.includes('menubar')]).toEqual([['panels'], true])
    const menubar = designer.querySelector<MenubarHost>('xh-menubar')!
    const select = (menu: string, id: string): void => void menubar.dispatchEvent(new CustomEvent('item-select', { detail: { menu, value: `${menu}/${id}` } }))
    select('file', 'settings')
    await designer.updateComplete
    expect(designer.querySelector<HTMLElement & { open?: boolean }>('xh-designer-settings')!.open).toBe(true)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      select('help', 'help')
      expect(open).toHaveBeenCalledWith(FLOW_DESIGNER_HELP_URL, '_blank', 'noopener,noreferrer')
    }
    finally {
      open.mockRestore()
    }
  })

  it('菜单栏：外框最上一条，文件、编辑、视图、帮助四张菜单；导出图片在文件里、设置收尾，对齐分布与自动布局在视图里，面板与外观收尾、两条显示开关在外观子菜单里', async () => {
    const designer = await mount()
    const menubar = designer.querySelector<MenubarHost>('xh-menubar')!
    expect(menubar.closest('[data-part="region"]')!.getAttribute('data-region')).toBe('menubar')
    const items = (menu: string): string[] => menubar.collection!.find(node => node.value === menu)!.items!.map(item => item.value.slice(menu.length + 1))
    expect(menubar.collection!.map(node => [node.value, node.label])).toEqual([['file', 'File'], ['edit', 'Edit'], ['view', 'View'], ['help', 'Help']])
    expect(items('file')).toEqual(['save', 'export-png', 'export-svg', 'settings'])
    expect(items('edit')).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'duplicate', 'select-all', 'edit-json'])
    expect(items('view')).toEqual(['zoom-in', 'zoom-out', 'zoom-to-fit', 'zoom-to-actual', 'pan-tool', 'align-menu', 'auto-layout', 'panels', 'appearance'])
    expect(items('help')).toEqual(['start-tour', 'help', 'shortcuts', 'about'])
    const appearance = menubar.collection!.find(node => node.value === 'view')!.items!.find(item => item.value === 'view/appearance')!
    const toggles = ['show-toolbar', 'show-status-bar'].map(id => `view/appearance/command:${id}`)
    expect([appearance.children!.map(child => [child.value, child.kind]), appearance.checkboxValue]).toEqual([toggles.map(value => [value, 'checkbox']), toggles])
  })

  it('菜单栏的条目执行命令：保存派发 save；显示开关改设置并派发 settings-change，关掉状态栏时外框不登记它', async () => {
    const designer = await mount()
    const menubar = designer.querySelector<MenubarHost>('xh-menubar')!
    const select = (menu: string, id: string): void => void menubar.dispatchEvent(new CustomEvent('item-select', { detail: { menu, value: `${menu}/${id}` } }))
    const saves: unknown[] = []
    designer.addEventListener('save', () => saves.push(1))
    const changes: [string, unknown][] = []
    designer.addEventListener('settings-change', event => changes.push([(event as CustomEvent<{ key: string }>).detail.key, (event as CustomEvent<{ value: unknown }>).detail.value]))
    select('file', 'save')
    expect(saves).toHaveLength(1)
    select('view', 'appearance/command:show-status-bar')
    await settleFrame(designer)
    const regions = (): string[] => (frameOf(designer) as HTMLElement & { regions: readonly { name: string }[] }).regions.map(region => region.name)
    expect([changes, regions().includes('status')]).toEqual([[['general.statusBar', false]], false])
  })

  it('宿主写在设计器上的 slot="menubar-end" 放到菜单栏右边一段，后来加的也一样', async () => {
    const title = document.createElement('span')
    title.slot = 'menubar-end'
    title.textContent = '请假审批'
    const designer = await mount(element => element.append(title))
    await settleFrame(designer)
    expect([title.parentElement!.getAttribute('data-zone'), title.closest('[data-region]')!.getAttribute('data-region')]).toEqual(['end', 'menubar'])
    const state = document.createElement('span')
    state.slot = 'menubar-end'
    designer.append(state)
    await settleFrame(designer)
    expect(state.closest('[data-region]')!.getAttribute('data-region')).toBe('menubar')
  })

  it('画布有焦点时按 F10 把焦点交给菜单栏，再按 F10 回到画布', async () => {
    const designer = await mount()
    await settleFrame(designer)
    const canvas = designer.querySelector<HTMLElement>('[data-flow-canvas]')!
    canvas.focus()
    const f10 = (): void => void (document.activeElement ?? canvas).dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true, cancelable: true }))
    f10()
    expect(designer.querySelector('xh-menubar')!.contains(document.activeElement)).toBe(true)
    f10()
    expect(document.activeElement).toBe(canvas)
  })

  it('「面板」点开一张锚在按钮上的菜单，列出物料、属性、问题与小地图，勾选的显示；选中一项开关它，布局写进设置的 layout.panels', async () => {
    const designer = await mount()
    await settleFrame(designer)
    const button = toolbarItem(designer, 'panels')
    button.click()
    await designer.updateComplete
    type MenuHost = HTMLElement & { open?: boolean, anchor?: HTMLElement | null, collection?: readonly { value: string, label?: string }[], checkboxValue?: readonly string[] }
    const menu = designer.querySelector<MenuHost>('[data-part="command-bar"] xh-menu')!
    expect([menu.open, menu.anchor]).toEqual([true, button])
    expect(menu.collection!.slice(0, 4).map(item => item.value)).toEqual(['item:palette', 'item:properties', 'item:issues', 'item:minimap'])
    expect(menu.checkboxValue).toEqual(['item:palette', 'item:properties', 'item:issues', 'item:minimap', 'item:outline'])
    const seen: string[] = []
    designer.addEventListener('settings-change', event => seen.push((event as CustomEvent<{ key: string }>).detail.key))
    // 复选条目点了只派发 checkbox-value-change，用真实的点击走一遍
    document.querySelector<HTMLElement>('[data-scope="menu"][data-part="item"][data-value="item:palette"]')!.click()
    await settleFrame(designer)
    expect(seen).toEqual(['layout.panels'])
    expect(designer.settings!['layout.panels']).toMatchObject({ version: 1, hidden: ['history', 'palette'] })
    expect(menu.checkboxValue).toEqual(['item:properties', 'item:issues', 'item:minimap', 'item:outline'])
    document.querySelector<HTMLElement>('[data-scope="menu"][data-part="item"][data-value="item:palette"]')!.click()
    await settleFrame(designer)
    expect(designer.settings!['layout.panels']).toMatchObject({ hidden: ['history'] })
  })

  it('每块面板一条 panel:<id> 命令：排进工具栏后点它开关小地图，文字取面板的名字', async () => {
    const designer = await mount(element => element.commandLayout = { toolbar: [['panel:minimap', 'panel:palette']] })
    await settleFrame(designer)
    const overlay = (): HTMLElement => designer.querySelector<HTMLElement>('[data-region="minimap"]')!
    expect([toolbarItem(designer, 'panel:minimap').textContent, toolbarItem(designer, 'panel:palette').textContent]).toEqual(['Minimap', 'Nodes'])
    expect([overlay().hidden, overlay().contains(designer.querySelector('xh-designer-minimap'))]).toEqual([false, true])
    toolbarItem(designer, 'panel:minimap').click()
    await settleFrame(designer)
    expect(overlay().hidden).toBe(true)
    expect(designer.settings!['layout.panels']).toMatchObject({ hidden: ['history', 'minimap'] })
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

  it('defaultLayout 藏掉的面板不显示，设置里存了布局时按存的；通用命令的文案跟着全局配置里 xh-designer-commands 那一桶变', async () => {
    const designer = await mount(element => element.defaultLayout = { version: 1, hidden: ['issues'] })
    await settleFrame(designer)
    expect([part(designer, 'command-bar'), part(designer, 'palette'), part(frameOf(designer), 'issues')].map(list => list.length)).toEqual([1, 1, 0])
    designer.settings = { 'layout.panels': { version: 1, hidden: ['palette'] } }
    setXhConfig({ translations: { 'xh-designer-commands': { undo: '撤销' } } })
    await settleFrame(designer)
    expect([part(designer, 'palette'), part(frameOf(designer), 'issues')].map(list => list.length)).toEqual([0, 1])
    expect(toolbarItem(designer, 'undo').textContent).toBe('撤销')
  })
})

type FrameElement = HTMLElement & {
  regions: readonly { name: string, title?: string, subtitle?: string, help?: string, icon?: unknown, position: string, anchor?: string }[]
  showsPanel: (name: string) => boolean
  panelEntries: () => readonly { name: string, locked: boolean }[]
}

describe('外框卡片', () => {
  it('物料、属性与问题画成卡片：面板头写标题与帮助，属性面板的副标题是当前编辑的对象；零件不画自己的标题', async () => {
    const designer = await mount()
    await settleFrame(designer)
    const frame = designer.querySelector<FrameElement>('xh-designer-frame')!
    const region = (name: string) => frame.regions.find(item => item.name === name)!
    expect(['palette', 'properties', 'issues'].map(name => [region(name).title, typeof region(name).help, typeof region(name).icon])).toEqual([
      ['Nodes', 'string', 'object'],
      ['Properties', 'string', 'object'],
      ['Problems', 'string', 'object'],
    ])
    expect([region('minimap').position, region('minimap').anchor, region('minimap').title, typeof region('minimap').icon]).toEqual(['overlay', 'bottom-end', 'Minimap', 'object'])
    expect([region('toolbar').title, region('canvas').title]).toEqual([undefined, undefined])
    designer.select({ nodes: ['t'] })
    await settleFrame(designer)
    expect(region('properties').subtitle).toBe('任务 · t')
    expect(frame.querySelector('[data-region="properties"] [data-part="panel-subtitle"]')!.textContent).toBe('任务 · t')
    const parts = ['xh-designer-palette', 'xh-designer-properties', 'xh-designer-issues'].map(tag => designer.querySelector<HTMLElement & { headless?: boolean }>(tag)!)
    expect(parts.map(element => element.headless)).toEqual([true, true, true])
  })

  it('点面板头的关闭钮隐藏这块面板：整份布局写进设置的 layout.panels 并派发 settings-change，宿主赋回 settings 照样生效', async () => {
    const designer = await mount()
    await settleFrame(designer)
    const frame = designer.querySelector<FrameElement>('xh-designer-frame')!
    const seen: { key: string, value: unknown, settings: Record<string, unknown> }[] = []
    designer.addEventListener('settings-change', event => seen.push((event as CustomEvent<{ key: string, value: unknown, settings: Record<string, unknown> }>).detail))
    frame.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.click()
    await settleFrame(designer)
    expect(seen.map(change => change.key)).toEqual(['layout.panels'])
    expect(seen[0]!.value).toMatchObject({ version: 1, hidden: ['history', 'palette'], docks: { start: ['palette', 'outline'], end: ['properties', 'history'], bottom: ['issues'] } })
    expect([seen[0]!.settings, designer.settings]).toEqual([{ 'layout.panels': seen[0]!.value }, { 'layout.panels': seen[0]!.value }])
    expect([frame.showsPanel('palette'), frame.showsPanel('properties')]).toEqual([false, true])

    designer.settings = { 'layout.panels': { version: 1, hidden: ['issues'] } }
    await settleFrame(designer)
    expect([frame.showsPanel('palette'), frame.showsPanel('issues')]).toEqual([true, false])
    expect(seen).toHaveLength(1)
  })

  it('settingsPolicy 管布局：layout.panels.<id> 藏掉一块，layout.panels 锁整份', async () => {
    const designer = await mount(element => element.settingsPolicy = { 'layout.panels.issues': 'hidden' })
    await settleFrame(designer)
    const frame = designer.querySelector<FrameElement>('xh-designer-frame')!
    expect(frame.panelEntries().map(entry => entry.name)).toEqual(['palette', 'properties', 'minimap', 'outline', 'history'])
    expect(part(frameOf(designer), 'issues')).toHaveLength(0)
    designer.settingsPolicy = { 'layout.panels': 'locked' }
    await settleFrame(designer)
    expect(frame.panelEntries().every(entry => entry.locked)).toBe(true)
    expect(frame.querySelector<HTMLElement>('[data-region="palette"] [data-part="panel-close"]')!.hidden).toBe(true)
  })
})

describe('状态栏', () => {
  function status(designer: Element, zone: 'start' | 'end'): string {
    const item = designer.querySelector(`[slot="status-${zone}"][data-part="status-item"], [data-zone="${zone}"] > [data-part="status-item"]`)!
    return Array.from(item.querySelectorAll<HTMLElement>('[data-part="status-label"], [data-part="status-value"]'), part => part.hidden ? '' : part.textContent).filter(Boolean).join(' ')
  }

  it('左段写选中对象：没选中时是节点与连线数，单选节点是类型与位置尺寸，单选连线是连线名，多选是已选几个', async () => {
    const designer = await mount()
    await settleFrame(designer)
    expect(status(designer, 'start')).toBe('Flow 3 nodes, 1 connection')
    designer.select({ nodes: ['t'] })
    await settleFrame(designer)
    expect(status(designer, 'start')).toBe('任务 X 200, Y 0 · 100 × 40')
    designer.select({ edges: ['st'] })
    await settleFrame(designer)
    expect(status(designer, 'start')).toBe('Connection st')
    designer.select({ nodes: ['s', 't'], edges: ['st'] })
    await settleFrame(designer)
    expect(status(designer, 'start')).toBe('3 selected')
  })

  it('右段写缩放，视口变了跟着变；点它回到 100%', async () => {
    const designer = await mount()
    placeCanvas(designer, 400, 300)
    designer.setViewport({ x: 0, y: 0, zoom: 0.5 })
    await settleFrame(designer)
    expect(status(designer, 'end')).toBe('Zoom 50%')
    designer.querySelector<HTMLButtonElement>('xh-button[data-part="status-item"] button')!.click()
    await settleFrame(designer)
    expect([designer.getViewport().zoom, status(designer, 'end')]).toEqual([1, 'Zoom 100%'])
  })
})

describe('物料面板', () => {
  function palette(designer: Element): HTMLElement & { updateComplete: Promise<unknown> } {
    return designer.querySelector('xh-designer-palette')!
  }

  function item(designer: Element, type: string): HTMLButtonElement {
    return palette(designer).querySelector<HTMLButtonElement>(`button[data-part="item"][data-id="${type}"]`)!
  }

  async function settle(designer: XhFlowDesigner): Promise<void> {
    await designer.updateComplete
    await palette(designer).updateComplete
  }

  /** jsdom 不排版：画布范围内的点都落在画布上，其余落在 body 上。 */
  function hitCanvas(designer: XhFlowDesigner, width: number, height: number): void {
    const root = part(designer, 'viewport')[0]!
    document.elementFromPoint = (x: number, y: number) => (x >= 0 && x <= width && y >= 0 && y <= height ? root : document.body)
  }

  afterEach(() => {
    Reflect.deleteProperty(document, 'elementFromPoint')
  })

  it('节点类型给了图标时物料条目带上图标', async () => {
    const play = { name: 'play', viewBox: '0 0 24 24', nodes: [{ tag: 'path' as const, attrs: { d: 'M8 5v14l11-7z' } }] }
    const designer = await mount(d => d.extensions = [{ id: 'test', nodeTypes: definitions.map(definition => definition.type === 'task' ? { ...definition, icon: play } : definition) }])
    await settle(designer)
    expect((item(designer, 'task').querySelector('xh-icon') as HTMLElement & { icon?: unknown }).icon).toBe(play)
    expect(item(designer, 'start').querySelector('xh-icon')).toBeNull()
  })

  it('按类别分组，没有类别的排最后；分组的先后与标题可换', async () => {
    const designer = await mount()
    await settle(designer)
    const groups = (): string[][] => Array.from(palette(designer).querySelectorAll('[data-part="group"]'), group => [
      group.querySelector('[data-part="group-label"]')!.textContent!,
      ...Array.from(group.querySelectorAll<HTMLElement>('button[data-part="item"]'), button => `${button.dataset.id}:${button.textContent}`),
    ])
    expect(groups()).toEqual([
      ['事件', 'start:开始', 'end:结束'],
      ['活动', 'task:任务'],
      ['Other', 'note:note'],
    ])
    expect(palette(designer).querySelector('[data-part="title"]')!.textContent).toBe('Nodes')

    designer.paletteGroupOrder = ['活动']
    designer.paletteGroupLabels = { 活动: '人工活动' }
    await settle(designer)
    expect(groups().map(group => group[0])).toEqual(['人工活动', '事件', 'Other'])
  })

  it('点条目在视口中央新建节点并选中', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 400)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    await settle(designer)
    item(designer, 'task').click()
    const added = designer.schema.nodes.at(-1)!
    expect([added.type, added.x, added.y]).toEqual(['task', 256, 176])
    expect(designer.getSelection().nodes).toEqual([added.id])
  })

  it('连点条目：新节点顺着右下方错开、不叠在一起，错到视口边上从左上角另起一列', async () => {
    const designer = await mount()
    placeCanvas(designer, 320, 240)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    await settle(designer)
    const before = designer.schema.nodes.length
    for (let click = 0; click < 8; click++)
      item(designer, 'task').click()
    const added = designer.schema.nodes.slice(before)
    const [first, second, third] = added as [FlowNode, FlowNode, FlowNode]
    const step = second.x - first.x
    expect(step).toBeGreaterThan(0)
    expect([second.y - first.y, third.x - second.x, third.y - second.y]).toEqual([step, step, step])
    expect(new Set(added.map(node => `${node.x},${node.y}`)).size).toBe(added.length)
    const wrapped = added.find(node => node.x < first.x && node.y < first.y)!
    expect([wrapped.x, wrapped.y]).toEqual([step, step])
    expect(added.every(node => node.x + node.width <= 320 && node.y + node.height <= 240)).toBe(true)
  })

  it('拖进画布在松手处新建节点：拖动中按网格画落点、藏起跟手预览；松手在画布外不新建', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 400)
    hitCanvas(designer, 600, 400)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    await settle(designer)
    const task = item(designer, 'task')
    const root = part(designer, 'viewport')[0]!
    const preview = part(designer, 'drop-preview')[0]!

    press(task, 5, 5)
    move(-50, 300)
    await designer.updateComplete
    expect(preview.hidden).toBe(true)
    const ghost = document.querySelector<HTMLElement>('[data-xh-designer-drag-preview]')!
    expect(ghost.hidden).toBe(false)
    move(310, 300)
    await designer.updateComplete
    expect(preview.hidden).toBe(false)
    expect([preview.style.left, preview.style.top]).toEqual(['256px', '288px'])
    expect(ghost.hidden).toBe(true)
    expect(root.dataset.gesture).toBe('drop')
    release(310, 300)
    task.click()
    await designer.updateComplete
    expect(preview.hidden).toBe(true)
    expect(root.dataset.gesture).toBeUndefined()
    expect(document.querySelector('[data-xh-designer-drag-preview]')).toBeNull()
    const added = designer.schema.nodes.at(-1)!
    expect([designer.schema.nodes.length, added.type, added.x, added.y]).toEqual([4, 'task', 256, 288])

    press(task, 5, 5)
    move(310, 300)
    move(-50, 300)
    release(-50, 300)
    await designer.updateComplete
    expect(designer.schema.nodes).toHaveLength(4)
    expect(preview.hidden).toBe(true)
  })

  it('扩展的物料来源接在内置分组后面：点它的条目交给它的 insert（不带落点），拖进画布放下时带上松手处的世界坐标', async () => {
    const calls: [string, FlowDesignerContext, FlowPoint | undefined][] = []
    const host: FlowDesignerExtension = {
      id: 'host',
      paletteSources: [{
        id: 'mine',
        groups: () => [{ id: 'mine', label: '我的物料', items: [{ id: 'approval-pair', label: '审批对', payload: 'task' }] }],
        insert: (paletteItem, context, at) => calls.push([paletteItem.id, context, at]),
      }],
    }
    const designer = await mount(d => d.extensions = [{ id: 'test', nodeTypes: definitions }, host])
    placeCanvas(designer, 600, 400)
    hitCanvas(designer, 600, 400)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    await settle(designer)
    expect(designer.getViewportCenter()).toEqual({ x: 300, y: 200 })
    expect(Array.from(palette(designer).querySelectorAll('[data-part="group-label"]'), label => label.textContent)).toEqual(['事件', '活动', 'Other', '我的物料'])

    const pair = item(designer, 'approval-pair')
    pair.click()
    expect(calls.map(([id, , at]) => [id, at])).toEqual([['approval-pair', undefined]])
    expect(calls[0]![1].designer).toBe(designer)
    expect(designer.schema.nodes).toHaveLength(3)

    press(pair, 5, 5)
    move(310, 300)
    await designer.updateComplete
    expect(part(designer, 'drop-preview')[0]!.hidden).toBe(true)
    release(310, 300)
    pair.click()
    await designer.updateComplete
    expect(calls.map(([id, , at]) => [id, at])).toEqual([['approval-pair', undefined], ['approval-pair', { x: 310, y: 300 }]])
    expect(designer.schema.nodes).toHaveLength(3)

    item(designer, 'task').click()
    expect(designer.schema.nodes.at(-1)!.type).toBe('task')
    expect(calls).toHaveLength(2)
  })

  it('物料来源每轮现取：内容没变时不重设分组，变了换上新的', async () => {
    let label = '审批对'
    const host: FlowDesignerExtension = {
      id: 'host',
      paletteSources: [{ id: 'mine', groups: () => [{ id: 'mine', label: '我的物料', items: [{ id: 'approval-pair', label }] }], insert: () => {} }],
    }
    const designer = await mount(d => d.extensions = [{ id: 'test', nodeTypes: definitions }, host])
    await settle(designer)
    const groups = (palette(designer) as HTMLElement & { groups?: unknown }).groups
    designer.select({ nodes: ['t'] })
    await settle(designer)
    expect((palette(designer) as HTMLElement & { groups?: unknown }).groups).toBe(groups)
    label = '会签'
    designer.select({ nodes: [] })
    await settle(designer)
    expect(item(designer, 'approval-pair').textContent).toBe('会签')
  })

  it('拖到画布边缘时按 pan-request 平移视口', async () => {
    const designer = await mount()
    placeCanvas(designer, 600, 400)
    designer.setViewport({ x: 0, y: 0, zoom: 1 })
    part(designer, 'viewport')[0]!.dispatchEvent(new CustomEvent('pan-request', { detail: { dx: 12, dy: -4 }, bubbles: true }))
    expect(designer.getViewport()).toEqual({ x: -12, y: 4, zoom: 1 })
  })

  it('只读时条目不能用、拖不进来，布局里隐藏物料时收起', async () => {
    const designer = await mount(element => element.readonly = true)
    await settle(designer)
    expect(Array.from(palette(designer).querySelectorAll('button[data-part="item"]')).every(button => button.getAttribute('aria-disabled') === 'true')).toBe(true)
    item(designer, 'task').click()
    expect(designer.schema.nodes).toHaveLength(3)
    const element = palette(designer)
    designer.settings = { 'layout.panels': { version: 1, hidden: ['palette'] } }
    await settleFrame(designer)
    expect(element.isConnected).toBe(false)
    designer.settings = undefined
    await settleFrame(designer)
    expect(element.isConnected).toBe(true)
  })
})

describe('问题列表', () => {
  const typed: FlowDesignerExtension = {
    id: 'test',
    nodeTypes: [
      ...definitions.filter(definition => definition.type !== 'task'),
      { type: 'task', label: '任务', size: { width: 100, height: 40 }, ports: 'both', properties: [{ path: ['data', 'owner'], control: { kind: 'text' }, label: '负责人', required: true }] },
      { type: 'single', size: { width: 100, height: 40 }, ports: 'none', minCount: 1 },
    ],
  }

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

  it('列出问题，错误在前，错误、警告数在面板头里；落在属性上的带属性名，节点上标出最严重的一级', async () => {
    const designer = await mount(element => element.extensions = [typed])
    await settle(designer)
    expect(rows(designer).map(item => [item.tagName, item.dataset.severity, item.querySelector('[data-part="issue-subject"]')!.textContent, item.querySelector('[data-part="issue-message"]')!.textContent])).toEqual([
      ['DIV', 'error', 'Flow', 'At least 1 single required, found 0'],
      ['BUTTON', 'error', '任务', '负责人: Required'],
      ['BUTTON', 'warning', '任务', 'No outgoing connection'],
      ['BUTTON', 'warning', '结束', 'Not connected'],
    ])
    const filter = designer.querySelector('[data-region="issues"] [data-part="panel-actions"] > [data-part="filter"]')!
    expect(list(designer).querySelector('[data-part="filter"]')).toBeNull()
    expect(filter.querySelector('button[value="error"]')!.textContent).toBe('2 errors')
    expect(filter.querySelector('button[value="warning"]')!.textContent).toBe('2 warnings')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="t"]')!.dataset.issue).toBe('error')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="e"]')!.dataset.issue).toBe('warning')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="s"]')!.dataset.issue).toBeUndefined()
  })

  it('再给 extensions 赋值（两次）以后，错误、警告数仍在面板头里，并且在文档里', async () => {
    const designer = await mount(element => element.extensions = [typed])
    await settle(designer)
    for (let round = 0; round < 2; round++) {
      designer.extensions = [...designer.extensions!]
      await settle(designer)
    }
    const filter = designer.querySelector<HTMLElement>('[data-region="issues"] [data-part="panel-actions"] > [data-part="filter"]')!
    expect(filter.isConnected).toBe(true)
    expect(filter.parentElement!.hidden).toBe(false)
    expect(filter.querySelector('button[value="error"]')!.textContent).toBe('2 errors')
  })

  it('点问题选中并显露所在节点，落在属性上时把焦点交给那个字段', async () => {
    const designer = await mount(element => element.extensions = [typed])
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

  it('没有问题时给提示，布局里隐藏全部面板时都收起，画布还在', async () => {
    const designer = await mount((element) => {
      element.validateOptions = { severity: { 'node.isolated': 'off', 'node.missing-outgoing': 'off', 'node.missing-incoming': 'off' } }
    })
    await settle(designer)
    expect(rows(designer)).toHaveLength(0)
    const empty = list(designer).querySelector<HTMLElement>('[data-part="empty"]')!
    expect([empty.hidden, empty.textContent]).toEqual([false, 'No problems'])
    const panels = ['command-bar', 'palette', 'properties', 'issues'].map(name => part(frameOf(designer), name)[0]!)
    designer.settings = { 'layout.panels': { version: 1, hidden: ['palette', 'properties', 'issues', 'minimap'] } }
    await settleFrame(designer)
    expect(panels.map(element => element.isConnected)).toEqual([true, false, false, false])
    expect(designer.querySelector<HTMLElement>('[data-region="minimap"]')!.hidden).toBe(true)
    expect(designer.querySelector('[data-region="canvas"] > [data-part="canvas"]')).not.toBeNull()
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

  it('浮在画布区右下角的落点上，不在画布内容里', async () => {
    const designer = await mount()
    await settleFrame(designer)
    const minimap = designer.querySelector('xh-designer-minimap')!
    expect(minimap.parentElement!.matches('[data-region="canvas"] > [data-part="overlay"][data-overlay="bottom-end"] > [data-region="minimap"]')).toBe(true)
    expect(designer.querySelector('[data-part="canvas"] xh-designer-minimap')).toBeNull()
  })

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

  it('没有节点时收起，布局里隐藏小地图时也收起', async () => {
    const designer = await mount(element => element.schema = { version: 1, nodes: [], edges: [] })
    const minimap = designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-minimap')!
    await minimap.updateComplete
    expect(minimap.hasAttribute('data-empty')).toBe(true)
    designer.schema = { version: 1, nodes: [{ id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40 }], edges: [] }
    await designer.updateComplete
    await minimap.updateComplete
    expect([minimap.hasAttribute('data-empty'), minimap.hidden]).toEqual([false, false])
    designer.settings = { 'layout.panels': { version: 1, hidden: ['minimap'] } }
    await settleFrame(designer)
    expect(minimap.closest<HTMLElement>('[data-region="minimap"]')!.hidden).toBe(true)
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
    expect(items()).toEqual(['cut', 'copy', 'duplicate', 'delete'])

    designer.select({ nodes: ['s', 't', 'e'] })
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    expect(items()).toEqual(['cut', 'copy', 'duplicate', 'delete', 'align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'distribute-horizontal', 'distribute-vertical'])

    rightClick(part(designer, 'edge-hit')[0]!)
    expect(items()).toEqual(['delete', 'clear-vertices(x)'])

    rightClick(part(designer, 'viewport')[0]!, 600, 600)
    expect(items()).toEqual(['paste(x)', 'select-all', 'auto-layout', 'zoom-to-fit', 'edit-json'])
  })

  it('选中条目执行命令，禁用的条目不执行', async () => {
    const designer = await mountMenu()
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    const menu = designer.querySelector('xh-context-menu')!
    menu.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'copy' } }))
    rightClick(part(designer, 'viewport')[0]!, 600, 600)
    expect(items()[0]).toBe('paste')
    menu.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'paste' } }))
    expect(designer.schema.nodes).toHaveLength(4)

    designer.readonly = true
    await designer.updateComplete
    rightClick(designer.querySelector('[data-part="node"][data-node-id="t"]')!)
    expect(items()).toEqual(['cut(x)', 'copy', 'duplicate(x)', 'delete(x)'])
    menu.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'delete' } }))
    menu.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'cut' } }))
    expect(designer.schema.nodes).toHaveLength(4)

    designer.readonly = false
    await designer.updateComplete
    designer.select({ nodes: ['t'] })
    menu.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'cut' } }))
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
    menu.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'clear-vertices' } }))
    expect(designer.schema.edges[0]).not.toHaveProperty('vertices')
  })
})
