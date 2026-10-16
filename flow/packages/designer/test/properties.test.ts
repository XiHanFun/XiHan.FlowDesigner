/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowPropertyEditor, FlowPropertyEditorContext, XhFlowDesigner } from '../src'
import { createNodeTypeRegistry } from '@xihan-flow/core'
import { setXhConfig } from '@xihan-ui/web-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner } from '../src'
import { definitions, mount, part, unmountAll } from './helpers'

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
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = real(element, pseudo)
    return new Proxy(style, {
      get(target, key) {
        if (key === 'getPropertyValue')
          return (name: string) => target.getPropertyValue(name) || STYLE_FALLBACK[name] || ''
        const value = Reflect.get(target, key) as unknown
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
      },
    })
  })
  vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(20)
})

afterEach(() => {
  unmountAll()
  setXhConfig({})
  vi.restoreAllMocks()
})

const typed = createNodeTypeRegistry([
  ...definitions.filter(definition => definition.type !== 'task'),
  {
    type: 'task',
    label: '任务',
    size: { width: 100, height: 40 },
    ports: 'both',
    properties: [
      { path: ['label'], control: { kind: 'text' }, group: 'basic', label: '名称', required: true },
      { path: ['data', 'retries'], control: { kind: 'number', integer: true, min: 0, unit: '次' }, group: 'run', label: '重试' },
      { path: ['data', 'mode'], control: { kind: 'select', options: [{ value: 'any', label: '任一' }, { value: 'all', label: '全部' }] }, group: 'run', label: '规则' },
      { path: ['data', 'urgent'], control: { kind: 'boolean' }, group: 'basic', label: '加急' },
      { path: ['data', 'tags'], control: { kind: 'tags' }, label: '标签' },
      { path: ['data', 'color'], control: { kind: 'color' }, label: '颜色' },
      { path: ['data', 'extra'], control: { kind: 'json' }, label: '扩展', meta: { description: '任意 JSON' } },
      { path: ['data', 'note'], control: { kind: 'text', multiline: true }, label: '备注', visibleWhen: { path: ['data', 'urgent'], equals: true } },
      { path: ['data', 'who'], control: { kind: 'assignees' }, label: '受理人' },
    ],
  },
])

async function mountTyped(setup: (designer: XhFlowDesigner) => void = () => {}): Promise<XhFlowDesigner> {
  return mount((designer) => {
    designer.nodeTypes = typed
    setup(designer)
  })
}

function row(designer: Element, path: string): HTMLElement {
  return designer.querySelector<HTMLElement>(`[data-part="property"][data-path="${path}"]`)!
}

function emit(target: Element, type: string, detail: unknown): void {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
}

async function settle(designer: XhFlowDesigner): Promise<void> {
  await designer.updateComplete
  await Promise.resolve()
  await designer.updateComplete
}

function task(designer: XhFlowDesigner) {
  return designer.schema.nodes.find(node => node.id === 't')!
}

describe('属性面板', () => {
  it('没选中、选中多个时给提示，选中一个时按分组列出显示中的属性', async () => {
    const designer = await mountTyped()
    expect(part(designer, 'properties-empty')[0]!.textContent).toBe('Select a node or connection to edit its properties')
    designer.select({ nodes: ['s', 't'] })
    await designer.updateComplete
    expect(part(designer, 'properties-empty')[0]!.textContent).toContain('2 items selected')

    designer.propertyGroupOrder = ['run']
    designer.propertyGroupLabels = { run: '执行' }
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    expect(part(designer, 'properties-subject')[0]!.textContent).toBe('任务 · t')
    const groups = part(designer, 'property-group').map(group => [
      group.querySelector('[data-part="property-group-label"]')?.textContent ?? '',
      ...Array.from(group.querySelectorAll<HTMLElement>('[data-part="property"]'), item => item.dataset.path),
    ])
    expect(groups).toEqual([
      ['执行', 'data.retries', 'data.mode'],
      ['basic', 'label', 'data.urgent'],
      ['', 'data.tags', 'data.color', 'data.extra', 'data.who'],
    ])
    expect(row(designer, 'label').querySelector('xh-text-field [data-xh-part="label"]')!.textContent).toBe('名称')
    expect(row(designer, 'data.retries').querySelector('[data-xh-part="suffix"]')!.textContent).toBe('次')
    expect(row(designer, 'data.extra').querySelector('[data-part="property-hint"]')!.textContent).toBe('任意 JSON')
    expect(row(designer, 'data.who').querySelector('[data-part="property-unsupported"]')!.textContent).toBe('assignees')
  })

  it('文本连续输入并成一步撤销，失焦后另起一步', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    const field = row(designer, 'label').querySelector('xh-text-field')!
    emit(field, 'value-change', { value: '审' })
    emit(field, 'value-change', { value: '审批' })
    expect(task(designer).label).toBe('审批')
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    emit(field, 'value-change', { value: '审批人' })
    designer.undo()
    expect(task(designer).label).toBe('审批')
    designer.undo()
    expect(task(designer)).not.toHaveProperty('label')
    await designer.updateComplete
    expect((field as HTMLElement & { value?: string }).value).toBe('')
  })

  it('数字、选择、开关、标签、颜色与 JSON 写回节点，选择改动显示条件后字段随之出现', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    emit(row(designer, 'data.retries').querySelector('xh-number-field')!, 'value-change', { value: '3', valueAsNumber: 3 })
    emit(row(designer, 'data.mode').querySelector('xh-select')!, 'value-change', { value: ['1'] })
    emit(row(designer, 'data.urgent').querySelector('xh-switch')!, 'checked-change', { checked: true })
    emit(row(designer, 'data.tags').querySelector('xh-tags-input')!, 'value-change', { value: ['a', 'b'] })
    emit(row(designer, 'data.color').querySelector('xh-color-field')!, 'value-change', { value: '#ff0000' })
    emit(row(designer, 'data.extra').querySelector('xh-text-field')!, 'value-change', { value: '{"a":1}' })
    expect(task(designer).data).toEqual({ retries: 3, mode: 'all', urgent: true, tags: ['a', 'b'], color: '#ff0000', extra: { a: 1 } })
    await designer.updateComplete
    expect(row(designer, 'data.note')).not.toBeNull()
    expect(row(designer, 'data.tags').querySelectorAll('[data-xh-part="item"]')).toHaveLength(2)

    emit(row(designer, 'data.retries').querySelector('xh-number-field')!, 'value-change', { value: '-', valueAsNumber: Number.NaN })
    emit(row(designer, 'data.mode').querySelector('xh-select')!, 'value-change', { value: [] })
    expect(task(designer).data).toMatchObject({ retries: 3 })
    expect(task(designer).data).not.toHaveProperty('mode')
  })

  it('不合法的 JSON 就地报错、不写回，改对后写回并清掉错误', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    const json = row(designer, 'data.extra')
    const field = json.querySelector('xh-text-field')!
    emit(field, 'value-change', { value: '{"a":' })
    const error = json.querySelector<HTMLElement>('[data-part="property-error"]')!
    expect([error.hidden, error.textContent, field.hasAttribute('invalid')]).toEqual([false, 'Not valid JSON', true])
    expect(task(designer).data).toBeUndefined()
    emit(field, 'value-change', { value: '{"a":2}' })
    await designer.updateComplete
    expect(task(designer).data).toEqual({ extra: { a: 2 } })
    expect([error.hidden, field.hasAttribute('invalid')]).toEqual([true, false])
  })

  it('必填未填时字段标为无效并显示问题说明', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await settle(designer)
    const label = row(designer, 'label')
    const field = label.querySelector('xh-text-field')!
    expect([field.hasAttribute('required'), field.hasAttribute('invalid')]).toEqual([true, true])
    expect(label.querySelector('[data-part="property-error"]')!.textContent).toBe('Required')
    emit(field, 'value-change', { value: '任务一' })
    await settle(designer)
    expect(field.hasAttribute('invalid')).toBe(false)
    expect(label.querySelector<HTMLElement>('[data-part="property-error"]')!.hidden).toBe(true)
  })

  it('宿主编辑器按编辑方式接管，拿到值、对象与只读状态，撤销后收到新值', async () => {
    const contexts: FlowPropertyEditorContext[] = []
    const editor: FlowPropertyEditor = (context) => {
      contexts.push(context)
      const element = document.createElement('div')
      element.dataset.custom = ''
      return { element, update: next => contexts.push(next) }
    }
    const designer = await mountTyped(element => element.propertyEditors = { byControl: { assignees: editor }, byPath: { 'data.color': editor } })
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    expect(row(designer, 'data.who').querySelector('[data-custom]')).not.toBeNull()
    expect(row(designer, 'data.who').querySelector('[data-part="property-label"]')!.textContent).toBe('受理人')
    expect(row(designer, 'data.color').querySelector('xh-color-field')).toBeNull()
    const who = contexts.find(context => context.descriptor.path.at(-1) === 'who')!
    expect([who.value, (who.target as { id: string }).id, who.readonly]).toEqual([undefined, 't', false])
    who.setValue({ users: ['u1'] })
    who.commit()
    expect(task(designer).data).toEqual({ who: { users: ['u1'] } })
    designer.undo()
    await designer.updateComplete
    expect(contexts.at(-1)!.value).toBeUndefined()
  })

  it('连线缺省编辑标签与虚线；宿主可换成自己的连线属性', async () => {
    const designer = await mountTyped()
    designer.select({ edges: ['st'] })
    await designer.updateComplete
    expect(part(designer, 'properties-subject')[0]!.textContent).toBe('Connection · st')
    expect(part(designer, 'property').map(item => item.dataset.path)).toEqual(['label', 'style.dashed'])
    emit(row(designer, 'label').querySelector('xh-text-field')!, 'value-change', { value: '同意' })
    emit(row(designer, 'style.dashed').querySelector('xh-switch')!, 'checked-change', { checked: true })
    expect(designer.schema.edges[0]).toMatchObject({ label: '同意', style: { dashed: true } })

    designer.edgeProperties = [{ path: ['data', 'condition'], control: { kind: 'text' }, label: '条件', required: true }]
    await settle(designer)
    expect(part(designer, 'property').map(item => item.dataset.path)).toEqual(['data.condition'])
    expect(designer.validate().map(issue => `${issue.code}@${issue.target?.id}`)).toContain('required@st')
  })

  it('只读时字段只读、写入无效；panels.properties 为 false 时收起', async () => {
    const designer = await mountTyped(element => element.readonly = true)
    designer.select({ nodes: ['t'] })
    await designer.updateComplete
    const field = row(designer, 'label').querySelector('xh-text-field')!
    expect(field.hasAttribute('read-only')).toBe(true)
    emit(field, 'value-change', { value: 'x' })
    expect(task(designer)).not.toHaveProperty('label')
    designer.panels = { properties: false }
    await designer.updateComplete
    expect(part(designer, 'properties')[0]!.hidden).toBe(true)
  })
})
