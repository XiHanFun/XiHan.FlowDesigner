/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { DesignerOutlineNode, XhDesignerOutlineElement } from '@xihan-ui/designer-shell'
import type { XhFlowDesigner } from '../src'
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, part, placeCanvas, sample, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  setXhConfig({})
})

type FrameElement = HTMLElement & { regions: readonly { name: string, position: string, title?: string }[], showsPanel: (name: string) => boolean, updateComplete: Promise<unknown> }

function frameOf(designer: XhFlowDesigner): FrameElement {
  return designer.querySelector<FrameElement>('xh-designer-frame')!
}

function outline(designer: XhFlowDesigner): XhDesignerOutlineElement {
  return designer.querySelector('xh-designer-outline')!
}

function rows(nodes: readonly DesignerOutlineNode[]): unknown[] {
  return nodes.map(node => [node.id, node.label, node.description, node.expanded, node.children?.map(child => [child.id, child.label, child.description])])
}

async function settle(designer: XhFlowDesigner): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await designer.updateComplete
    await frameOf(designer).updateComplete
    await outline(designer)?.updateComplete
  }
}

describe('流程结构面板', () => {
  it('缺省显示在左栏物料下面；节点为行，从它出去的连线列在下面、缺省收起，没有名称的写「种类名 · id」，连线写「条件 → 去向」', async () => {
    const designer = await mount((element) => {
      const schema = sample()
      element.schema = {
        ...schema,
        nodes: schema.nodes.map(node => node.id === 't' ? { ...node, label: '经理审批' } : node),
        edges: [...schema.edges, { id: 'te', source: { node: 't' }, target: { node: 'e' }, data: { condition: 'amount > 1000' } }],
      }
    })
    await settle(designer)
    const frame = frameOf(designer)
    expect(frame.regions.find(region => region.name === 'outline')).toMatchObject({ position: 'start', title: 'Flow structure' })
    expect(frame.showsPanel('outline')).toBe(true)
    expect(rows(outline(designer).nodes!)).toEqual([
      ['node:s', '开始 · s', undefined, false, [['edge:st', 'Connection · st', '→ 经理审批']]],
      ['node:t', '经理审批', '任务', false, [['edge:te', 'Connection · te', 'amount > 1000 → 结束 · e']]],
      ['node:e', '结束 · e', undefined, undefined, undefined],
    ])
    expect(outline(designer).querySelector<HTMLElement & { expandedValue?: string[] }>('xh-tree')!.expandedValue).toEqual([])
  })

  it('选中一行就在画布上选中并显露它；画布上的选择反过来交给面板，选中连线时展开它的出发节点', async () => {
    const designer = await mount()
    placeCanvas(designer, 200, 100)
    designer.setViewport({ x: -2000, y: -2000, zoom: 1 })
    await settle(designer)
    outline(designer).dispatchEvent(new CustomEvent('node-select', { detail: { ids: ['node:e'] }, bubbles: true }))
    expect(designer.getSelection()).toEqual({ nodes: ['e'], edges: [] })
    expect(designer.getViewport()).not.toEqual({ x: -2000, y: -2000, zoom: 1 })
    designer.setViewport({ x: -2000, y: -2000, zoom: 1 })
    outline(designer).dispatchEvent(new CustomEvent('node-select', { detail: { ids: ['edge:st'] }, bubbles: true }))
    expect(designer.getSelection()).toEqual({ nodes: [], edges: ['st'] })
    expect(designer.getViewport()).not.toEqual({ x: -2000, y: -2000, zoom: 1 })
    await settle(designer)
    expect(outline(designer).selection).toEqual(['edge:st'])
    expect(outline(designer).querySelector<HTMLElement & { expandedValue?: string[] }>('xh-tree')!.expandedValue).toEqual(['node:s'])
  })

  it('悬停的行在画布上标出，离开时撤掉；删除走设计器的删除，只读时不删', async () => {
    const designer = await mount()
    await settle(designer)
    const node = (): HTMLElement => part(designer, 'node').find(element => element.dataset.nodeId === 't')!
    const edge = (): Element => designer.querySelector('[data-part="edge"][data-edge-id="st"]')!
    outline(designer).dispatchEvent(new CustomEvent('node-highlight', { detail: { id: 'node:t' }, bubbles: true }))
    await settle(designer)
    expect(node().hasAttribute('data-highlighted')).toBe(true)
    outline(designer).dispatchEvent(new CustomEvent('node-highlight', { detail: { id: 'edge:st' }, bubbles: true }))
    await settle(designer)
    expect([node().hasAttribute('data-highlighted'), edge().hasAttribute('data-highlighted')]).toEqual([false, true])
    outline(designer).dispatchEvent(new CustomEvent('node-highlight', { detail: { id: null }, bubbles: true }))
    await settle(designer)
    expect(edge().hasAttribute('data-highlighted')).toBe(false)
    outline(designer).dispatchEvent(new CustomEvent('node-delete', { detail: { ids: ['node:e'] }, bubbles: true }))
    expect(designer.schema.nodes.map(item => item.id)).toEqual(['s', 't'])
    designer.readonly = true
    await settle(designer)
    expect(outline(designer).readonly).toBe(true)
    outline(designer).dispatchEvent(new CustomEvent('node-delete', { detail: { ids: ['node:t'] }, bubbles: true }))
    expect(designer.schema.nodes.map(item => item.id)).toEqual(['s', 't'])
  })

  it('标题、帮助与搜索框用流程自己的说法，跟着全局配置换语言', async () => {
    setXhConfig(mergeXhConfig(flowZhCN, {}))
    const designer = await mount()
    await settle(designer)
    expect(frameOf(designer).regions.find(region => region.name === 'outline')!.title).toBe('流程结构')
    expect(outline(designer).querySelector('input')!.getAttribute('aria-label')).toBe('搜索流程结构')
  })
})
