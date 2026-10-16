/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import { setXhConfig } from '@xihan-ui/web-components'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, move, part, placeCanvas, press, release, unmountAll } from './helpers'

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
