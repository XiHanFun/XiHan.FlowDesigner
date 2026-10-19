/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { XhFlowDesigner } from '../src'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner, flowSelectionLayout } from '../src'
import { mount, part, placeCanvas, press, release, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(unmountAll)

/** 变换覆盖层里选中工具条的按钮；工具条不在时为 undefined。 */
function buttons(designer: XhFlowDesigner): string[] | undefined {
  const bar = designer.querySelector('xh-designer-transform [data-part="toolbar"] xh-toolbar')
  return bar === null ? undefined : Array.from(bar.querySelectorAll('button[value]'), button => button.getAttribute('value')!)
}

describe('选中工具条', () => {
  it('选中一个节点时放进变换覆盖层：创建副本、复制、删除；几个节点时前面多一个对齐与分布菜单；只选连线或没选中时不放', async () => {
    const designer = await mount()
    expect(buttons(designer)).toBeUndefined()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    expect(buttons(designer)).toEqual(['duplicate', 'copy', 'delete'])
    designer.select({ nodes: ['s', 't'] })
    await designer.updateComplete
    expect(buttons(designer)).toEqual(['align-menu', 'duplicate', 'copy', 'delete'])
    designer.select({ edges: ['st'] })
    await designer.updateComplete
    expect(buttons(designer)).toBeUndefined()
    expect([flowSelectionLayout('node'), flowSelectionLayout('nodes')]).toEqual([[['duplicate', 'copy', 'delete']], [['align-menu'], ['duplicate', 'copy', 'delete']]])
  })

  it('排列取 commandLayout 的 selection:node / selection:nodes；排空了就不放；只读时不放', async () => {
    const designer = await mount(element => (element.commandLayout = { 'selection:node': [['delete']], 'selection:nodes': [] }))
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    expect(buttons(designer)).toEqual(['delete'])
    designer.select({ nodes: ['s', 't'] })
    await designer.updateComplete
    expect(buttons(designer)).toBeUndefined()
    designer.commandLayout = undefined
    designer.readonly = true
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    expect(buttons(designer)).toBeUndefined()
  })

  it('点按钮执行命令；Alt + F10 把焦点交给工具条', async () => {
    const designer = await mount()
    designer.select({ nodes: ['e'] })
    await designer.updateComplete
    const event = new KeyboardEvent('keydown', { key: 'F10', altKey: true, bubbles: true, cancelable: true })
    part(designer, 'viewport')[0]!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(designer.querySelector('xh-designer-transform [data-part="toolbar"]')!.contains(document.activeElement)).toBe(true)
    designer.querySelector<HTMLButtonElement>('xh-designer-transform [data-part="toolbar"] button[value="delete"]')!.click()
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 't'])
  })

  it('在工具条上按下松开不当作点画布空白处，选中不变；工具条接走的方向键不微移节点，没接的键照旧交给画布', async () => {
    const designer = await mount()
    placeCanvas(designer, 800, 600)
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    const copy = designer.querySelector<HTMLButtonElement>('xh-designer-transform [data-part="toolbar"] button[value="copy"]')!
    press(copy, 300, 20)
    release(300, 20)
    await designer.updateComplete
    expect(designer.getSelection().nodes).toEqual(['t'])
    copy.focus()
    const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    copy.dispatchEvent(arrow)
    expect(arrow.defaultPrevented).toBe(true)
    expect(designer.schema.nodes.find(node => node.id === 't')!.x).toBe(200)
    copy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 'e'])
  })
})
