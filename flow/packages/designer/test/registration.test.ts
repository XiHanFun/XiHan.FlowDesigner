/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

// 只调 defineFlowDesigner()、宿主不全量注册 UI 元素时，设计器用到的每个 xh-* 元素都要由它注册并升级：
// 选中一个铺满七种编辑器的节点、问题列表有条目、右键菜单打开，页面上出现的 xh-* 元素逐个核对。

import type { FlowDesignerExtension, XhFlowDesigner } from '../src'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner } from '../src'
import { definitions, mount, unmountAll } from './helpers'

defineFlowDesigner()

// jsdom 不排版：多行文本框自动增高要读的计算样式与内容高度给出浏览器里的缺省值
const STYLE_FALLBACK: Readonly<Record<string, string>> = {
  'writing-mode': 'horizontal-tb',
  'box-sizing': 'border-box',
  'max-block-size': 'none',
  'padding-top': '0px',
  'padding-bottom': '0px',
  'border-top-width': '0px',
  'border-bottom-width': '0px',
  'font-size': '14px',
  'line-height': '20px',
}

beforeEach(() => {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => new Proxy(real(element, pseudo), {
    get(target, key) {
      if (key === 'getPropertyValue')
        return (name: string) => target.getPropertyValue(name) || STYLE_FALLBACK[name] || ''
      const value = Reflect.get(target, key) as unknown
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  }))
  vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(20)
})

afterEach(() => {
  unmountAll()
  vi.restoreAllMocks()
})

const typed: FlowDesignerExtension = {
  id: 'test',
  nodeTypes: [...definitions.filter(definition => definition.type !== 'task'), {
    type: 'task',
    label: '任务',
    category: '活动',
    size: { width: 100, height: 40 },
    ports: 'both',
    properties: [
      { path: ['label'], control: { kind: 'text' }, group: 'basic', label: '名称', required: true },
      { path: ['data', 'note'], control: { kind: 'text', multiline: true }, group: 'basic', label: '备注' },
      { path: ['data', 'retries'], control: { kind: 'number', integer: true, min: 0, unit: '次' }, group: 'run', label: '重试' },
      { path: ['data', 'mode'], control: { kind: 'select', options: [{ value: 'any', label: '任一' }, { value: 'all', label: '全部' }, { value: 'one', label: '单人' }] }, group: 'run', label: '规则' },
      { path: ['data', 'urgent'], control: { kind: 'boolean' }, group: 'basic', label: '加急' },
      { path: ['data', 'tags'], control: { kind: 'tags' }, label: '标签' },
      { path: ['data', 'color'], control: { kind: 'color' }, label: '颜色' },
      { path: ['data', 'extra'], control: { kind: 'json' }, label: '扩展' },
    ],
  }],
}

async function settle(designer: XhFlowDesigner): Promise<void> {
  for (let round = 0; round < 4; round++) {
    await designer.updateComplete
    await Promise.resolve()
  }
}

/** 页面上没有升级的 xh-* 元素：标签没注册，或注册了却还不是那个类的实例。 */
function notUpgraded(): string[] {
  const tags = new Set<string>()
  for (const element of Array.from(document.querySelectorAll('*'))) {
    if (!element.localName.startsWith('xh-'))
      continue
    const ctor = customElements.get(element.localName)
    if (!ctor || !(element instanceof ctor))
      tags.add(element.localName)
  }
  return [...tags].sort()
}

describe('defineFlowDesigner 按需注册', () => {
  it('只调 defineFlowDesigner：工具栏、物料、属性面板七种编辑器、问题列表、小地图与右键菜单里的 xh-* 元素都已升级', async () => {
    const designer = await mount(element => element.extensions = [typed])
    designer.select({ nodes: ['t'] })
    await settle(designer)
    designer.querySelector('[data-part="node"][data-node-id="t"]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await settle(designer)

    const seen = new Set(Array.from(document.querySelectorAll('*'), element => element.localName).filter(tag => tag.startsWith('xh-')))
    expect([...seen].sort()).toEqual(expect.arrayContaining([
      'xh-color-field',
      'xh-context-menu',
      'xh-designer-frame',
      'xh-designer-issues',
      'xh-designer-minimap',
      'xh-designer-palette',
      'xh-designer-properties',
      'xh-designer-transform',
      'xh-field',
      'xh-number-field',
      'xh-select',
      'xh-splitter',
      'xh-switch',
      'xh-tags-input',
      'xh-text-field',
      'xh-toggle-group',
      'xh-toolbar',
    ]))
    expect(notUpgraded()).toEqual([])
  })
})
