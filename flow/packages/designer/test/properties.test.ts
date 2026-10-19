/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDesignerExtension, FlowPropertyEditor, FlowPropertyEditorContext, FlowPropertyTarget, XhFlowDesigner } from '../src'
import { setXhConfig } from '@xihan-ui/web-components'
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

const typed: FlowDesignerExtension = {
  id: 'test',
  controls: { assignees: {} },
  nodeTypes: [...definitions.filter(definition => definition.type !== 'task'), {
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
  }],
}

async function mountTyped(setup: (designer: XhFlowDesigner) => void = () => {}): Promise<XhFlowDesigner> {
  return mount((designer) => {
    designer.extensions = [typed]
    setup(designer)
  })
}

function panel(designer: Element): HTMLElement & { updateComplete: Promise<unknown> } {
  return designer.querySelector('xh-designer-properties')!
}

function inPanel(designer: Element, name: string): HTMLElement[] {
  return Array.from(panel(designer).querySelectorAll<HTMLElement>(`[data-part="${name}"]`))
}

function row(designer: Element, path: string): HTMLElement {
  return panel(designer).querySelector<HTMLElement>(`[data-part="property"][data-path="${path}"]`)!
}

function emit(target: Element, type: string, detail: unknown): void {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
}

/** 设计器更新后属性面板再更新一轮，问题列表的计算也要等一个微任务。 */
async function settle(designer: XhFlowDesigner): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await designer.updateComplete
    await panel(designer).updateComplete
    await Promise.resolve()
  }
}

function task(designer: XhFlowDesigner) {
  return designer.schema.nodes.find(node => node.id === 't')!
}

describe('属性面板', () => {
  it('没选中时给提示；选中一个时按分组列出显示中的属性，标题下写对象名与 id', async () => {
    const designer = await mountTyped()
    await settle(designer)
    expect(inPanel(designer, 'empty')[0]!.textContent).toBe('Select nodes or connections to edit their properties')
    designer.propertyGroupOrder = ['run']
    designer.propertyGroupLabels = { run: '执行' }
    designer.select({ nodes: ['t'] })
    await settle(designer)
    expect(inPanel(designer, 'heading')[0]!.textContent).toBe('任务 · t')
    const groups = inPanel(designer, 'group').map(group => [
      group.querySelector('[data-part="group-label"]')?.textContent ?? '',
      ...Array.from(group.querySelectorAll<HTMLElement>('[data-part="property"]'), item => item.dataset.path),
    ])
    expect(groups).toEqual([
      ['执行', 'data.retries', 'data.mode'],
      ['basic', 'label', 'data.urgent'],
      ['', 'data.tags', 'data.color', 'data.extra', 'data.who'],
    ])
    expect(row(designer, 'label').querySelector('[data-xh-part="label"]')!.textContent).toBe('名称')
    expect(row(designer, 'data.retries').querySelector('[data-xh-part="suffix"]')!.textContent).toBe('次')
    expect(row(designer, 'data.extra').querySelector('[data-xh-part="description"]')!.textContent).toBe('任意 JSON')
    expect(row(designer, 'data.who').querySelector('[data-control="unsupported"]')!.textContent).toBe('assignees')
  })

  it('选中多个时只列共同属性，一次输入同时写进每个对象、记为一步', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['s', 't'], edges: ['st'] })
    await settle(designer)
    expect(inPanel(designer, 'heading')[0]!.textContent).toBe('3 items selected')
    expect(inPanel(designer, 'property').map(item => item.dataset.path)).toEqual(['label'])
    const field = row(designer, 'label').querySelector('xh-text-field')!
    emit(field, 'value-change', { value: '同' })
    emit(field, 'value-change', { value: '同名' })
    expect(designer.schema.nodes.filter(node => node.id !== 'e').map(node => node.label)).toEqual(['同名', '同名'])
    expect(designer.schema.edges[0]!.label).toBe('同名')
    designer.undo()
    expect(designer.schema.nodes.every(node => node.label === undefined)).toBe(true)
    expect(designer.schema.edges[0]!.label).toBeUndefined()
  })

  it('文本连续输入并成一步撤销，失焦后另起一步', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await settle(designer)
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
    await settle(designer)
    expect((field as HTMLElement & { value?: string }).value).toBe('')
  })

  it('数字、选择、开关、标签、颜色与 JSON 写回节点，选择改动显示条件后字段随之出现', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await settle(designer)
    emit(row(designer, 'data.retries').querySelector('xh-number-field')!, 'value-change', { value: '3', valueAsNumber: 3 })
    emit(row(designer, 'data.mode').querySelector('xh-select')!, 'value-change', { value: ['1'] })
    emit(row(designer, 'data.urgent').querySelector('xh-switch')!, 'checked-change', { checked: true })
    emit(row(designer, 'data.tags').querySelector('xh-tags-input')!, 'value-change', { value: ['a', 'b'] })
    emit(row(designer, 'data.color').querySelector('xh-color-field')!, 'value-change', { value: '#ff0000' })
    emit(row(designer, 'data.extra').querySelector('xh-text-field')!, 'value-change', { value: '{"a":1}' })
    expect(task(designer).data).toEqual({ retries: 3, mode: 'all', urgent: true, tags: ['a', 'b'], color: '#ff0000', extra: { a: 1 } })
    await settle(designer)
    expect(row(designer, 'data.note')).not.toBeNull()

    emit(row(designer, 'data.retries').querySelector('xh-number-field')!, 'value-change', { value: '-', valueAsNumber: Number.NaN })
    emit(row(designer, 'data.mode').querySelector('xh-select')!, 'value-change', { value: [] })
    expect(task(designer).data).toMatchObject({ retries: 3 })
    expect(task(designer).data).not.toHaveProperty('mode')
  })

  it('不合法的 JSON 就地报错、不写回，改对后写回并清掉错误', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await settle(designer)
    const json = row(designer, 'data.extra')
    const field = json.querySelector('xh-text-field')!
    emit(field, 'value-change', { value: '{"a":' })
    await settle(designer)
    expect(json.querySelector('[data-xh-part="error-text"]')!.textContent).toBe('Not valid JSON')
    expect(json.querySelector('xh-field')!.hasAttribute('invalid')).toBe(true)
    expect(task(designer).data).toBeUndefined()
    emit(field, 'value-change', { value: '{"a":2}' })
    await settle(designer)
    expect(task(designer).data).toEqual({ extra: { a: 2 } })
    expect(json.querySelector('xh-field')!.hasAttribute('invalid')).toBe(false)
  })

  it('必填未填时字段标为无效并显示问题说明，填上后清掉', async () => {
    const designer = await mountTyped()
    designer.select({ nodes: ['t'] })
    await settle(designer)
    const label = row(designer, 'label')
    const field = label.querySelector('xh-field')!
    expect([field.hasAttribute('required'), field.hasAttribute('invalid')]).toEqual([true, true])
    expect(label.querySelector('[data-xh-part="error-text"]')!.textContent).toBe('Required')
    emit(label.querySelector('xh-text-field')!, 'value-change', { value: '任务一' })
    await settle(designer)
    expect(field.hasAttribute('invalid')).toBe(false)
  })

  it('宿主编辑器按编辑方式或路径接管，拿到值、全部对象与只读状态，撤销后收到新值', async () => {
    const contexts: FlowPropertyEditorContext[] = []
    const editor: FlowPropertyEditor = (context) => {
      contexts.push(context)
      const element = document.createElement('div')
      element.dataset.custom = ''
      return { element, update: next => contexts.push(next) }
    }
    const designer = await mountTyped(element => element.extensions = [typed, { id: 'host', editors: { byControl: { assignees: editor }, byPath: { 'data.color': editor } } }])
    designer.select({ nodes: ['t'] })
    await settle(designer)
    expect(row(designer, 'data.who').querySelector('[data-control="custom"] [data-custom]')).not.toBeNull()
    // 宿主编辑器没标 control 时整行按一组控件接线：标签是 property-label，名称经 aria-labelledby 接到整行
    const whoRow = row(designer, 'data.who')
    expect([whoRow.getAttribute('role'), whoRow.querySelector('[data-part="property-label"]')!.textContent]).toEqual(['group', '受理人'])
    expect(row(designer, 'data.color').querySelector('xh-color-field')).toBeNull()
    const who = contexts.find(context => context.descriptor.path.at(-1) === 'who')!
    const targets = who.target as readonly FlowPropertyTarget[]
    expect([who.value, targets.map(target => [target.kind, target.id]), who.readonly]).toEqual([undefined, [['task', 't']], false])
    who.setValue({ users: ['u1'] })
    who.commit()
    expect(task(designer).data).toEqual({ who: { users: ['u1'] } })
    designer.undo()
    await settle(designer)
    expect(contexts.at(-1)!.value).toBeUndefined()
  })

  it('连线缺省编辑标签与虚线；扩展追加的连线属性与源节点类型的出线属性接在后面', async () => {
    const designer = await mountTyped()
    designer.select({ edges: ['st'] })
    await settle(designer)
    expect(inPanel(designer, 'heading')[0]!.textContent).toBe('Connection · st')
    expect(inPanel(designer, 'property').map(item => item.dataset.path)).toEqual(['label', 'style.dashed'])
    emit(row(designer, 'label').querySelector('xh-text-field')!, 'value-change', { value: '同意' })
    emit(row(designer, 'style.dashed').querySelector('xh-switch')!, 'checked-change', { checked: true })
    expect(designer.schema.edges[0]).toMatchObject({ label: '同意', style: { dashed: true } })

    const withOutgoing: FlowDesignerExtension = {
      ...typed,
      nodeTypes: typed.nodeTypes!.map(type => type.type === 'start' ? { ...type, outgoingEdges: [{ path: ['data', 'priority'], control: { kind: 'number' }, label: '优先级' }] } : type),
    }
    designer.extensions = [withOutgoing, { id: 'host', edgeProperties: [{ path: ['data', 'condition'], control: { kind: 'text' }, label: '条件', required: true }] }]
    await settle(designer)
    expect(inPanel(designer, 'property').map(item => item.dataset.path)).toEqual(['label', 'style.dashed', 'data.condition', 'data.priority'])
    expect(designer.validate().map(issue => `${issue.code}@${issue.target?.id}`)).toContain('required@st')
  })

  it('什么都没选中时编辑流程定义级属性，扩展的数据写进 extensions 下自己的那块', async () => {
    const definition: FlowDesignerExtension = {
      id: 'acme',
      documentProperties: [
        { path: ['data', 'code'], control: { kind: 'text' }, label: '编码', required: true },
        { path: ['extensions', 'acme', 'weight'], control: { kind: 'number' }, label: '权重' },
      ],
    }
    const designer = await mountTyped(element => (element.extensions = [typed, definition]))
    await settle(designer)
    expect(inPanel(designer, 'heading')[0]!.textContent).toBe('Flow')
    expect(inPanel(designer, 'property').map(item => item.dataset.path)).toEqual(['data.code', 'extensions.acme.weight'])
    expect(row(designer, 'data.code').querySelector('xh-field')!.hasAttribute('invalid')).toBe(true)
    emit(row(designer, 'data.code').querySelector('xh-text-field')!, 'value-change', { value: 'leave' })
    emit(row(designer, 'extensions.acme.weight').querySelector('xh-number-field')!, 'value-change', { value: '2', valueAsNumber: 2 })
    expect([designer.schema.data, designer.schema.extensions]).toEqual([{ code: 'leave' }, { acme: { weight: 2 } }])
    await settle(designer)
    expect(row(designer, 'data.code').querySelector('xh-field')!.hasAttribute('invalid')).toBe(false)
    emit(row(designer, 'extensions.acme.weight').querySelector('xh-number-field')!, 'value-change', { value: '', valueAsNumber: Number.NaN })
    expect(designer.schema).not.toHaveProperty('extensions')
    designer.select({ nodes: ['t'] })
    await settle(designer)
    expect(inPanel(designer, 'heading')[0]!.textContent).toBe('任务 · t')
  })

  it('只读时字段只读、写入无效；布局里隐藏属性面板时收起', async () => {
    const designer = await mountTyped(element => element.readonly = true)
    designer.select({ nodes: ['t'] })
    await settle(designer)
    expect(row(designer, 'label').querySelector('xh-field')!.hasAttribute('read-only')).toBe(true)
    emit(row(designer, 'label').querySelector('xh-text-field')!, 'value-change', { value: 'x' })
    expect(task(designer)).not.toHaveProperty('label')
    const element = panel(designer)
    designer.settings = { 'layout.panels': { version: 1, hidden: ['properties'] } }
    await designer.updateComplete
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-frame')!.updateComplete
    expect(element.isConnected).toBe(false)
  })
})
