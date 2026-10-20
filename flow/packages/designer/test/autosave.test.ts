/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

// 自动保存与调试日志：开着自动保存时改了停手约一秒存成本机草稿，存完（markSaved）删掉；宿主装进同一个草稿键、
// 和草稿不一样的流程时问恢复还是丢弃。渲染调试日志在开发者模式与这一路都开着时记每次重画。

import type { FlowDocument } from '@xihan-flow/core'
import { DESIGNER_COMMANDS_EN_US } from '@xihan-ui/designer-shell'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, sample, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  vi.useRealTimers()
  unmountAll()
  localStorage.clear()
  document.body.replaceChildren()
})

const KEY = 'xh-designer-draft:xh-flow-designer:p1'

async function until<T>(read: () => T | null | undefined): Promise<T> {
  for (let round = 0; round < 100; round++) {
    const value = read()
    if (value)
      return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('等了 1 秒仍没到期望的状态')
}

function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
}

function withDraft(): FlowDocument {
  const base = sample()
  return { ...base, nodes: [...base.nodes, { id: 'n', type: 'task', x: 0, y: 200, width: 100, height: 40 }] }
}

describe('自动保存', () => {
  it('开着时改了停手约一秒存成草稿，键是设计器种类加 draftKey；markSaved 后草稿删掉；关着时不存', async () => {
    const designer = await mount((element) => {
      element.draftKey = 'p1'
      element.settings = { 'general.autoSave': true }
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    designer.addNode('task')
    vi.advanceTimersByTime(999)
    expect(localStorage.getItem(KEY)).toBeNull()
    vi.advanceTimersByTime(1)
    expect((JSON.parse(localStorage.getItem(KEY)!) as { document: FlowDocument }).document).toEqual(designer.schema)
    designer.markSaved()
    expect(localStorage.getItem(KEY)).toBeNull()
    designer.settings = {}
    await designer.updateComplete
    designer.addNode('task')
    vi.advanceTimersByTime(1000)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('宿主装进同一个键、和草稿不一样的流程时问「发现未保存的草稿」：恢复后流程换成草稿、记一步撤销', async () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: withDraft() }))
    const designer = await mount(element => (element.draftKey = 'p1'))
    const restore = await until(() => button(DESIGNER_COMMANDS_EN_US.draftRestore))
    expect(document.body.textContent).toContain(DESIGNER_COMMANDS_EN_US.draftFoundDescription)
    restore.click()
    await until(() => designer.schema.nodes.some(node => node.id === 'n'))
    expect(designer.canUndo).toBe(true)
  })

  it('选丢弃：草稿删掉，流程照旧；草稿和装进的一样时不问、悄悄删掉', async () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: withDraft() }))
    const designer = await mount(element => (element.draftKey = 'p1'))
    ;(await until(() => button(DESIGNER_COMMANDS_EN_US.draftDiscard))).click()
    await until(() => localStorage.getItem(KEY) === null)
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 't', 'e'])
    unmountAll()
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: sample() }))
    await mount(element => (element.draftKey = 'p1'))
    await until(() => localStorage.getItem(KEY) === null)
    expect(button(DESIGNER_COMMANDS_EN_US.draftRestore)).toBeUndefined()
  })
})

describe('渲染调试日志', () => {
  it('开发者模式与渲染日志都开着时，每次重画在控制台记一组「[xh-flow-designer] render · update: 改动的属性 耗时」；关掉开发者模式就不记', async () => {
    const group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
    const end = vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    try {
      const designer = await mount()
      designer.readonly = true
      await designer.updateComplete
      expect(group).not.toHaveBeenCalled()
      designer.settings = { 'general.developer': true, 'general.debugRender': true }
      await designer.updateComplete
      group.mockClear()
      designer.readonly = false
      await designer.updateComplete
      const titles = group.mock.calls.map(call => String(call[0]))
      expect(titles).toContainEqual(expect.stringMatching(/^\[xh-flow-designer\] render · update: readonly \d+\.\d ms$/))
      designer.settings = { 'general.debugRender': true }
      await designer.updateComplete
      group.mockClear()
      designer.readonly = true
      await designer.updateComplete
      expect(group).not.toHaveBeenCalled()
    }
    finally {
      group.mockRestore()
      end.mockRestore()
    }
  })
})
