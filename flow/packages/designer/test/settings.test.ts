/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDesignerContext, FlowDesignerExtension, XhFlowDesigner } from '../src'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner, FLOW_SETTING_KEYS, FLOW_SETTINGS_SECTION } from '../src'
import { mount, nodes, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  localStorage.clear()
})

async function settle(designer: XhFlowDesigner): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await designer.updateComplete
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-settings')!.updateComplete
    await Promise.resolve()
  }
}

function row(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-setting="${key}"]`)
}

function pages(): string[] {
  return Array.from(document.querySelectorAll('xh-tabs [data-xh-part="list"] > button'), button => button.getAttribute('value')!)
}

function minimap(designer: Element): HTMLElement {
  return designer.querySelector<HTMLElement>('xh-designer-minimap')!
}

describe('设置', () => {
  it('openSettings 打开设置对话框：基础在前、画布在后，画布分区列出自动布局、小地图与吸附；基础里有状态栏', async () => {
    const designer = await mount()
    designer.openSettings('flow')
    await settle(designer)
    expect(pages()).toEqual(['general', 'flow'])
    expect(['layoutDirection', 'nodeGap', 'layerGap', 'minimap', 'snap'].map(id => row(`flow.${id}`) !== null)).toEqual([true, true, true, true, true])
    expect([row('general.theme') !== null, row('general.statusBar') !== null]).toEqual([true, true])
    expect(row('flow.layoutDirection')!.querySelector('xh-toggle-group')).not.toBeNull()
  })

  it('settingsPolicy 隐藏条目或整个分区，锁定的只读', async () => {
    const designer = await mount((element) => {
      element.settingsPolicy = { 'general': 'hidden', 'flow.snap': 'locked' }
    })
    designer.openSettings()
    await settle(designer)
    expect(pages()).toEqual(['flow'])
    expect(row('flow.snap')!.querySelector('xh-field')!.hasAttribute('read-only')).toBe(true)
  })

  it('在对话框里关掉小地图：settings 换成新的一份、派发 settings-change，小地图收起；赋回 settings 打开它', async () => {
    const designer = await mount()
    designer.openSettings()
    await settle(designer)
    expect(minimap(designer).hidden).toBe(false)
    const changes: unknown[] = []
    designer.addEventListener('settings-change', event => changes.push((event as CustomEvent).detail))
    row('flow.minimap')!.querySelector('xh-switch')!.dispatchEvent(new CustomEvent('checked-change', { detail: { checked: false }, bubbles: true }))
    await settle(designer)
    expect(changes).toEqual([{ key: 'flow.minimap', value: false, settings: { 'flow.minimap': false } }])
    expect(designer.settings).toEqual({ 'flow.minimap': false })
    expect(minimap(designer).hidden).toBe(true)
    designer.settings = {}
    await settle(designer)
    expect(minimap(designer).hidden).toBe(false)
  })

  it('自动布局没给的方向与间距取设置；命令与扩展从上下文的 settings 读到缺省值与写了的值', async () => {
    const seen: FlowDesignerContext['settings'][] = []
    const probe: FlowDesignerExtension = { id: 'probe', commands: [{ id: 'probe.read', label: 'Read', placement: ['toolbar'], run: context => void seen.push(context.settings) }] }
    const designer = await mount((element) => {
      element.extensions = [nodes, probe]
      // 宿主经包入口的常量给设置，不手写键
      element.settings = { [FLOW_SETTING_KEYS.layoutDirection]: 'LR', [FLOW_SETTING_KEYS.layerGap]: 100 }
    })
    const at = (id: string): { x: number, y: number, width: number, height: number } => designer.schema.nodes.find(node => node.id === id)!
    designer.autoLayout()
    expect([at('t').x - at('s').x - at('s').width, at('t').y]).toEqual([100, at('s').y])
    designer.autoLayout({ direction: 'TB' })
    expect(at('t').y - at('s').y - at('s').height).toBe(100)
    await designer.updateComplete
    designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="probe.read"]')!.click()
    expect(seen[0]).toMatchObject({ 'flow.layoutDirection': 'LR', 'flow.nodeGap': 24, 'flow.layerGap': 100, 'flow.minimap': true, 'flow.snap': true })
    expect([FLOW_SETTINGS_SECTION, Object.values(FLOW_SETTING_KEYS).every(key => key.startsWith(`${FLOW_SETTINGS_SECTION}.`))]).toEqual(['flow', true])
  })

  it('主题与主题色落在设计器元素上：亮暗写 data-theme，预设主题色写 data-brand，跟随页面时去掉', async () => {
    const designer = await mount((element) => {
      element.brands = [{ value: 'green', color: '#16a34a' }]
      element.settings = { 'general.theme': 'dark' }
    })
    expect(designer.getAttribute('data-theme')).toBe('dark')
    designer.settings = { 'general.brand': 'green' }
    await designer.updateComplete
    expect([designer.getAttribute('data-theme'), designer.getAttribute('data-brand')]).toEqual(['light', 'green'])
    designer.settings = {}
    await designer.updateComplete
    expect([designer.hasAttribute('data-theme'), designer.hasAttribute('data-brand')]).toEqual([false, false])
  })

  it('给了 settingsStorageKey：没赋 settings 时从存储读，对话框里改了就写回；读出的不是对象时派发 settings-storage-error', async () => {
    localStorage.setItem('flow-settings', JSON.stringify({ 'flow.snap': false }))
    const designer = await mount(element => (element.settingsStorageKey = 'flow-settings'))
    expect(designer.settings).toEqual({ 'flow.snap': false })
    designer.openSettings()
    await settle(designer)
    row('flow.minimap')!.querySelector('xh-switch')!.dispatchEvent(new CustomEvent('checked-change', { detail: { checked: false }, bubbles: true }))
    expect(JSON.parse(localStorage.getItem('flow-settings')!)).toEqual({ 'flow.snap': false, 'flow.minimap': false })

    localStorage.setItem('broken', '[1]')
    const errors: unknown[] = []
    await mount((element) => {
      element.addEventListener('settings-storage-error', event => errors.push((event as CustomEvent).detail))
      element.settingsStorageKey = 'broken'
    })
    expect(errors).toEqual([expect.objectContaining({ operation: 'read', key: 'broken' })])
  })

  it('扩展登记的设置分区放进对话框；分区 id 与 flow、general 或彼此重名时赋值即抛错', async () => {
    const section = { id: 'acme', label: 'Acme', order: 200, items: [{ path: ['token'], label: 'Token', control: { kind: 'text' as const, secret: true } }] }
    const designer = await mount(element => (element.extensions = [nodes, { id: 'acme', settings: [section] }]))
    designer.openSettings('acme')
    await settle(designer)
    expect(pages()).toEqual(['general', 'flow', 'acme'])
    expect(row('acme.token')!.querySelector('xh-password-input')).not.toBeNull()
    const before = designer.extensions
    for (const id of ['flow', 'general']) {
      const assign = (): unknown => (designer.extensions = [nodes, { id: 'acme', settings: [{ ...section, id }] }])
      expect(assign).toThrow(DesignerExtensionError)
    }
    expect(designer.extensions).toBe(before)
  })

  it('工具栏显示方式取设置里的 general.toolbarDisplay，缺省只显示图标', async () => {
    const designer = await mount()
    const shell = (): Element => designer.querySelector('xh-tooltip[data-scope="designer-commands"]')!
    expect(shell().getAttribute('data-display')).toBe('icon')
    designer.settings = { 'general.toolbarDisplay': 'both' }
    await designer.updateComplete
    expect(shell().getAttribute('data-display')).toBe('both')
    designer.settings = { 'general.toolbarDisplay': 'text' }
    await designer.updateComplete
    expect(shell().getAttribute('data-display')).toBe('text')
  })

  it('设置里关掉状态栏：外框不显示它；这时关掉一块面板，panels 仍留着 status，再打开状态栏照样出现', async () => {
    const designer = await mount()
    const frame = designer.querySelector<HTMLElement & { showsPanel: (name: string) => boolean, updateComplete: Promise<unknown> }>('xh-designer-frame')!
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(true)
    designer.settings = { 'general.statusBar': false }
    await designer.updateComplete
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(false)
    frame.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.click()
    await designer.updateComplete
    expect(designer.panels!.split(' ')).toContain('status')
    designer.settings = {}
    await designer.updateComplete
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(true)
  })

  it('吸附对齐按设置开关：关掉后拖动不吸附其它节点', async () => {
    const designer = await mount((element) => {
      element.settings = { 'flow.snap': false }
    })
    const transform = designer.querySelector<HTMLElement & { getSnap?: () => { targets?: readonly unknown[] } | undefined }>('xh-designer-transform')!
    expect(transform.getSnap!()?.targets ?? []).toEqual([])
    designer.settings = {}
    await designer.updateComplete
    expect((transform.getSnap!()?.targets ?? []).length).toBeGreaterThan(0)
  })
})
