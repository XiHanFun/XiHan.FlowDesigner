/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { XhDesignerSettingsElement, XhDesignerTourElement } from '@xihan-ui/designer-shell'
import type { FlowDesignerExtension, XhFlowDesigner } from '../src'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { DESIGNER_SETTING_KEYS, DESIGNER_TOUR_DONE_KEY } from '@xihan-ui/designer-shell'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner, FLOW_VERSION } from '../src'
import { mount, nodes, placeCanvas, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(unmountAll)

/** 给画布一个尺寸（jsdom 没有布局），再刷新一轮：像设计器从藏着到显示出来。 */
async function show(designer: XhFlowDesigner): Promise<void> {
  placeCanvas(designer, 800, 600)
  designer.requestUpdate()
  await designer.updateComplete
  await designer.updateComplete
}

function tour(designer: XhFlowDesigner): XhDesignerTourElement {
  return designer.querySelector('xh-designer-tour')!
}

function settings(designer: XhFlowDesigner): XhDesignerSettingsElement {
  return designer.querySelector('xh-designer-settings')!
}

function toolbarButtons(designer: XhFlowDesigner): string[] {
  return Array.from(designer.querySelectorAll('[data-part="command-bar"] [data-scope="toolbar"] button[value]'), button => button.getAttribute('value')!)
}

describe('新手引导', () => {
  it('画布有了尺寸才自动开始，藏着时不开始；走完、跳过或关上后设置里记下 help.tourDone 并派发 settings-change', async () => {
    const designer = await mount(element => (element.autoTour = undefined))
    await designer.updateComplete
    expect(tour(designer).running).toBe(false)
    await show(designer)
    expect(tour(designer).running).toBe(true)
    const keys: string[] = []
    designer.addEventListener('settings-change', event => keys.push((event as CustomEvent<{ key: string }>).detail.key))
    tour(designer).stop()
    tour(designer).dispatchEvent(new CustomEvent('tour-end', { detail: { reason: 'skip', step: 'shell.welcome' }, bubbles: true }))
    expect([keys, designer.settings?.[DESIGNER_TOUR_DONE_KEY]]).toEqual([[DESIGNER_TOUR_DONE_KEY], true])
  })

  it('同一页只开一个引导：别的设计器的引导开着时不自动开始；startTour() 先收起开着的那个', async () => {
    const first = await mount(element => (element.autoTour = undefined))
    const second = await mount(element => (element.autoTour = undefined))
    await show(first)
    expect(tour(first).running).toBe(true)
    await show(second)
    expect(tour(second).running).toBe(false)
    expect(second.startTour()).toBe(true)
    expect([tour(first).running, tour(second).running]).toEqual([false, true])
    tour(second).stop()
  })

  it('设置里记过 help.tourDone 时不再自动开始；autoTour 为 false 时也不自动开始', async () => {
    const done = await mount((element) => {
      element.autoTour = undefined
      element.settings = { [DESIGNER_TOUR_DONE_KEY]: true }
    })
    await show(done)
    expect(tour(done).running).toBe(false)
    const off = await mount()
    await show(off)
    expect(tour(off).running).toBe(false)
  })

  it('流程自己的几步排在通用步骤之后：插入节点、连线与自动布局；startTour 与 start-tour 命令都能从头开始', async () => {
    const designer = await mount()
    expect(tour(designer).steps!.map(step => step.id)).toEqual(['flow.insert', 'flow.connect', 'flow.autoLayout'])
    expect(tour(designer).steps!.map(step => step.title)).toEqual(['Insert nodes', 'Connect', 'Auto layout'])
    expect(designer.startTour()).toBe(true)
    tour(designer).stop()
    designer.commandLayout = { toolbar: [['start-tour']] }
    await designer.updateComplete
    designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="start-tour"]')!.click()
    expect(tour(designer).running).toBe(true)
    tour(designer).stop()
  })

  it('扩展的 tourSteps 并进来；步骤 id 重名或用了 shell. 前缀时赋值即抛错', async () => {
    const designer = await mount()
    const simulation: FlowDesignerExtension = { id: '@acme/simulation', tourSteps: [{ id: '@acme/simulation.run', title: 'Simulate', description: 'Run the flow.', order: 200 }] }
    designer.extensions = [nodes, simulation]
    await designer.updateComplete
    expect(tour(designer).steps!.map(step => step.id).at(-1)).toBe('@acme/simulation.run')
    const twin: FlowDesignerExtension = { id: '@acme/twin', tourSteps: [{ id: '@acme/simulation.run', title: 'x', description: 'x' }] }
    expect(() => (designer.extensions = [nodes, simulation, twin])).toThrow(DesignerExtensionError)
    const shell: FlowDesignerExtension = { id: '@acme/shell', tourSteps: [{ id: 'shell.mine', title: 'x', description: 'x' }] }
    expect(() => (designer.extensions = [nodes, shell])).toThrow(DesignerExtensionError)
  })
})

describe('帮助、快捷键与关于', () => {
  it('帮助页是几段说明与「开始引导」「帮助」两颗钮；按钮派发 settings-command 时关上对话框再跑命令', async () => {
    const designer = await mount()
    const dialog = settings(designer)
    expect(dialog.help!.notes).toHaveLength(4)
    expect(dialog.help!.actions!.map(action => [action.command, action.label])).toEqual([['start-tour', 'Start tour'], ['help', 'Help']])
    designer.openSettings('help')
    await designer.updateComplete
    dialog.dispatchEvent(new CustomEvent('settings-command', { detail: { command: 'start-tour' }, bubbles: true }))
    await designer.updateComplete
    expect([dialog.open, tour(designer).running]).toEqual([false, true])
    tour(designer).stop()
  })

  it('快捷键表从命令表生成，流程自己那组末尾补上剪贴板三键、Backspace 删除、右键菜单与保存，重做那行带上 Ctrl + Y；通用里去掉空格，方向键与 Esc 按流程的做法改写', async () => {
    const designer = await mount()
    const source = settings(designer).shortcuts!
    const designerRows = source.groups.find(group => group.id === 'designer')!.rows
    expect(designerRows.slice(-6).map(row => [row.label, row.keys])).toEqual([
      ['Copy', [['Mod', 'C']]],
      ['Cut', [['Mod', 'X']]],
      ['Paste', [['Mod', 'V']]],
      ['Delete', [['Backspace']]],
      ['Open the context menu', [['Shift', 'F10'], ['ContextMenu']]],
      ['Save', [['Mod', 'S']]],
    ])
    expect(source.groups.find(group => group.id === 'edit')!.rows.find(row => row.label === 'Redo')!.keys).toEqual([['Mod', 'Shift', 'Z'], ['Ctrl', 'Y']])
    expect(source.commonKeys!.map(key => [key.id, key.label])).toEqual([
      ['nudge', 'Move the selected nodes; pan the canvas when no node is selected'],
      ['nudgeLarge', undefined],
      ['selectionToolbar', undefined],
      ['cancel', 'Cancel the drag in progress'],
    ])
  })

  it('关于页写流程设计器的版本与许可证，后面接扩展的几行', async () => {
    const designer = await mount(element => (element.extensions = [nodes, { id: '@acme/pro', about: [{ label: 'Pro', value: '1.2.3' }] }]))
    expect(settings(designer).about).toEqual({ product: 'Flow designer', version: FLOW_VERSION, license: 'MIT', rows: [{ label: 'Pro', value: '1.2.3' }] })
    expect(FLOW_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('工具栏页', () => {
  it('设置对话框的「工具栏」页列出缺省排列，名字取短文字；toolbar.layout 藏起的按钮不上工具栏', async () => {
    const designer = await mount()
    const source = settings(designer).toolbar
    expect(source === false || source === undefined).toBe(false)
    if (!source)
      return
    expect(source.defaults[0]).toEqual(['undo', 'redo'])
    expect(source.commands.find(command => command.id === 'undo')!.label).toBe('Undo')
    expect(toolbarButtons(designer)).toContain('zoom-in')
    designer.settings = { [DESIGNER_SETTING_KEYS.toolbarLayout]: { groups: source.defaults.map(group => [...group]), hidden: ['zoom-in'] } }
    await designer.updateComplete
    expect(toolbarButtons(designer)).not.toContain('zoom-in')
    expect(toolbarButtons(designer)).toContain('zoom-out')
  })

  it('toolbar.visible 为 false 时外框不登记工具栏', async () => {
    const designer = await mount()
    const frame = designer.querySelector<HTMLElement & { regions?: readonly { name: string }[], updateComplete: Promise<unknown> }>('xh-designer-frame')!
    expect(frame.regions!.some(region => region.name === 'toolbar')).toBe(true)
    designer.settings = { [DESIGNER_SETTING_KEYS.toolbarVisible]: false }
    await designer.updateComplete
    expect(frame.regions!.some(region => region.name === 'toolbar')).toBe(false)
  })
})
