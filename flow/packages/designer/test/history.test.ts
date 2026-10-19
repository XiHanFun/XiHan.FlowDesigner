/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { DesignerHistoryEventMap, XhDesignerHistoryElement } from '@xihan-ui/designer-shell'
import type { XhFlowDesigner } from '../src'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, part, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(unmountAll)

function key(designer: XhFlowDesigner, init: KeyboardEventInit): void {
  part(designer, 'viewport')[0]!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

function undoName(designer: XhFlowDesigner): string | null {
  return designer.querySelector('[data-part="command-bar"] button[value="undo"]')!.getAttribute('aria-label')
}

function historyPanel(designer: XhFlowDesigner): XhDesignerHistoryElement {
  return designer.querySelector('xh-designer-history')!
}

describe('撤销历史', () => {
  it('每一步带说明：撤销钮的名字写「撤销：<说明>」，创建副本、自动布局、属性修改与 JSON 整份替换也各有说明', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    key(designer, { key: 'ArrowRight' })
    await designer.updateComplete
    expect(undoName(designer)).toBe('Undo: Move 任务 t')
    designer.duplicate()
    await designer.updateComplete
    expect(undoName(designer)).toBe('Undo: Copy 任务 t')
    designer.select({ nodes: ['t'] })
    designer.autoLayout()
    await designer.updateComplete
    expect(undoName(designer)).toBe('Undo: Auto layout')
    const properties = designer.querySelector('xh-designer-properties')!
    properties.dispatchEvent(new CustomEvent('property-change', { detail: { path: ['label'], value: '审批', targets: [{ kind: 'task', id: 't' }] }, bubbles: true }))
    await designer.updateComplete
    expect(undoName(designer)).toBe('Undo: Change “Label”')
    designer.querySelector('xh-designer-json-editor')!.dispatchEvent(new CustomEvent('json-apply', { detail: { value: { version: 1, nodes: [], edges: [] } }, bubbles: true }))
    await designer.updateComplete
    expect(undoName(designer)).toBe('Undo: Edit JSON')
  })

  it('微移按选中合并成一步；换了选中另起一步', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    key(designer, { key: 'ArrowRight' })
    key(designer, { key: 'ArrowDown' })
    designer.undo()
    expect(designer.schema.nodes.find(node => node.id === 't')).toMatchObject({ x: 200, y: 0 })
    designer.redo()
    key(designer, { key: 'ArrowRight' })
    designer.select({ nodes: ['s'] })
    designer.select({ nodes: ['t'] })
    key(designer, { key: 'ArrowRight' })
    designer.undo()
    expect(designer.schema.nodes.find(node => node.id === 't')!.x).toBe(202)
  })

  it('ctrl + Y 与 Ctrl / ⌘ + Shift + Z 都重做：Ctrl + Y 是重做命令的第二快捷键', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    key(designer, { key: 'ArrowRight' })
    designer.undo()
    key(designer, { key: 'y', ctrlKey: true })
    expect(designer.schema.nodes.find(node => node.id === 't')!.x).toBe(201)
    designer.undo()
    key(designer, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(designer.schema.nodes.find(node => node.id === 't')!.x).toBe(201)
  })
})

describe('历史记录面板', () => {
  it('缺省隐藏、停在右栏；panel:history 打开后列出每一步，选一步就跳过去，面板头是清空历史', async () => {
    const designer = await mount(element => (element.commandLayout = { toolbar: [['undo', 'panel:history']] }))
    const frame = designer.querySelector<HTMLElement & { showsPanel: (name: string) => boolean, updateComplete: Promise<unknown> }>('xh-designer-frame')!
    await frame.updateComplete
    expect(frame.showsPanel('history')).toBe(false)
    designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="panel:history"]')!.click()
    await designer.updateComplete
    await frame.updateComplete
    expect(frame.showsPanel('history')).toBe(true)
    designer.select({ nodes: ['t'] })
    key(designer, { key: 'ArrowRight' })
    designer.select({ nodes: ['s'] })
    key(designer, { key: 'ArrowDown' })
    await designer.updateComplete
    const snapshot = historyPanel(designer).snapshot!
    expect([snapshot.position, snapshot.entries.map(entry => entry.label)]).toEqual([snapshot.entries.at(-1)!.position, ['Move 任务 t', 'Move 开始 s']])
    historyPanel(designer).dispatchEvent(new CustomEvent('history-go', { detail: { position: snapshot.origin } as DesignerHistoryEventMap['history-go']['detail'], bubbles: true }))
    expect(designer.schema.nodes.map(node => [node.x, node.y])).toEqual([[0, 0], [200, 0], [400, 200]])
    expect(designer.querySelector('[slot="history-actions"] button[value="clear-history"]')).not.toBeNull()
  })

  it('只读时只能看，选一步不跳', async () => {
    const designer = await mount()
    designer.select({ nodes: ['t'] })
    key(designer, { key: 'ArrowRight' })
    designer.querySelector<HTMLElement & { togglePanel: (name: string) => void }>('xh-designer-frame')!.togglePanel('history')
    designer.readonly = true
    await designer.updateComplete
    historyPanel(designer).dispatchEvent(new CustomEvent('history-go', { detail: { position: historyPanel(designer).snapshot!.origin }, bubbles: true }))
    expect(designer.schema.nodes.find(node => node.id === 't')!.x).toBe(201)
  })
})
