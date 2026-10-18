/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowPropertyEditor, XhFlowDesigner } from '../src'
import { createXihanWorkflow, fromWorkflowDefinition, XIHAN_WORKFLOW_START_VARIABLES } from '@xihan-flow/core/presets/xihan-workflow'
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { setXhConfig } from '@xihan-ui/web-components'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner } from '../src'
import { mount, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(() => {
  unmountAll()
  setXhConfig({})
})

type Control = HTMLElement & { value?: unknown, checked?: boolean, columns?: readonly { id: string, label?: string }[] }

function schema() {
  return fromWorkflowDefinition({
    code: 'expense',
    name: '报销',
    variables: [{ name: 'amount', type: 'number', required: true, defaultValue: 100, description: '金额' }],
    nodes: [{ id: 'start', activityType: 'Start' }, { id: 'end', activityType: 'End' }],
    transitions: [{ id: 'a', sourceNodeId: 'start', targetNodeId: 'end' }],
  })
}

async function mountPreset(setup: (designer: XhFlowDesigner) => void = () => {}): Promise<XhFlowDesigner> {
  const designer = await mount((element) => {
    element.extensions = [createXihanWorkflow()]
    element.schema = schema()
    setup(element)
  })
  await settle(designer)
  return designer
}

function panel(designer: Element): HTMLElement & { updateComplete: Promise<unknown> } {
  return designer.querySelector('xh-designer-properties')!
}

async function settle(designer: XhFlowDesigner): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await designer.updateComplete
    await panel(designer).updateComplete
    await Promise.resolve()
  }
}

function row(designer: Element): HTMLElement {
  return panel(designer).querySelector<HTMLElement>('[data-part="property"][data-path="data.variables"]')!
}

function table(designer: Element): Control {
  return row(designer).querySelector<Control>('xh-field-array')!
}

function items(designer: Element): HTMLElement[] {
  return Array.from(table(designer).querySelectorAll<HTMLElement>('[data-xh-part="item"]'))
}

function cell(item: HTMLElement, column: string): Control {
  return item.querySelector(`[data-xh-part="item-cell"][value="${column}"]`)!.firstElementChild as Control
}

function emit(target: Element, type: string, detail: unknown): void {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
}

function variables(designer: XhFlowDesigner): unknown {
  return designer.schema.data?.variables
}

describe('启动变量的内建编辑器', () => {
  it('流程定义的启动变量排成表格：变量名、必填、缺省值与说明各一列，每格有可访问名', async () => {
    const designer = await mountPreset()
    const list = table(designer)
    expect([list.getAttribute('layout'), list.getAttribute('aria-label')]).toEqual(['table', 'Start variables'])
    expect(list.columns!.map(column => [column.id, column.label])).toEqual([
      ['name', 'Name'],
      ['required', 'Required'],
      ['defaultValue', 'Default value'],
      ['description', 'Description'],
    ])
    const [first] = items(designer)
    expect([cell(first!, 'name').value, cell(first!, 'required').checked, cell(first!, 'defaultValue').value, cell(first!, 'description').value])
      .toEqual(['amount', true, '100', '金额'])
    expect(cell(first!, 'defaultValue').getAttribute('aria-label')).toBe('Default value of variable 1')
    expect(list.querySelector('[data-xh-part="add-trigger"]')!.textContent).toBe('Add variable')
  })

  it('改一格只写那个变量的那个字段，别的字段原样保留；连续输入并成一步撤销', async () => {
    const designer = await mountPreset()
    const name = cell(items(designer)[0]!, 'name')
    emit(name, 'value-change', { value: 't' })
    emit(name, 'value-change', { value: 'total' })
    name.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    emit(cell(items(designer)[0]!, 'required'), 'checked-change', { checked: false })
    emit(cell(items(designer)[0]!, 'description'), 'value-change', { value: '' })
    expect(variables(designer)).toEqual([{ name: 'total', type: 'number', required: false, defaultValue: 100 }])
    designer.undo()
    designer.undo()
    expect(variables(designer)).toEqual([{ name: 'total', type: 'number', required: true, defaultValue: 100, description: '金额' }])
    designer.undo()
    await settle(designer)
    expect(variables(designer)).toEqual([{ name: 'amount', type: 'number', required: true, defaultValue: 100, description: '金额' }])
    expect(cell(items(designer)[0]!, 'name').value).toBe('amount')
  })

  it('缺省值按 JSON 读写：写不成 JSON 时这一格标为无效、不写入，改对后写入；清空即不设缺省值', async () => {
    const designer = await mountPreset()
    const fallback = cell(items(designer)[0]!, 'defaultValue')
    emit(fallback, 'value-change', { value: 'abc' })
    await settle(designer)
    expect([fallback.hasAttribute('invalid'), fallback.value]).toEqual([true, 'abc'])
    expect(variables(designer)).toMatchObject([{ defaultValue: 100 }])
    emit(fallback, 'value-change', { value: '"abc"' })
    await settle(designer)
    expect([fallback.hasAttribute('invalid'), variables(designer)]).toMatchObject([false, [{ defaultValue: 'abc' }]])
    emit(fallback, 'value-change', { value: '{"limit": 5}' })
    expect(variables(designer)).toMatchObject([{ defaultValue: { limit: 5 } }])
    emit(fallback, 'value-change', { value: ' ' })
    expect((variables(designer) as object[])[0]).not.toHaveProperty('defaultValue')
  })

  it('删掉一行后各行按位置换成剩下的变量，格里没写进去的文字不留在别的变量上', async () => {
    const designer = await mountPreset((element) => {
      element.schema = { ...element.schema, data: { ...element.schema.data, variables: [{ name: 'a' }, { name: 'b' }] } }
    })
    emit(cell(items(designer)[0]!, 'defaultValue'), 'value-change', { value: 'oops' })
    await settle(designer)
    items(designer)[0]!.querySelector<HTMLButtonElement>('[data-xh-part="item-delete-trigger"]')!.click()
    await settle(designer)
    expect(variables(designer)).toEqual([{ name: 'b' }])
    const fallback = cell(items(designer)[0]!, 'defaultValue')
    expect([cell(items(designer)[0]!, 'name').value, fallback.value, fallback.hasAttribute('invalid')]).toEqual(['b', '', false])
  })

  it('新增一行是空变量名、不必填，属性报不能为空；删掉后问题跟着消失', async () => {
    const designer = await mountPreset()
    table(designer).querySelector<HTMLButtonElement>('[data-xh-part="add-trigger"]')!.click()
    await settle(designer)
    expect(variables(designer)).toEqual([
      { name: 'amount', type: 'number', required: true, defaultValue: 100, description: '金额' },
      { name: '', required: false },
    ])
    expect(items(designer)).toHaveLength(2)
    expect(cell(items(designer)[1]!, 'name').getAttribute('aria-label')).toBe('Name of variable 2')
    expect(designer.validate().map(issue => issue.code)).toContain('empty')
    expect(row(designer).querySelector('[data-part="property-error"]')!.textContent).toBe('Cannot be empty')

    items(designer)[1]!.querySelector<HTMLButtonElement>('[data-xh-part="item-delete-trigger"]')!.click()
    await settle(designer)
    expect(variables(designer)).toEqual([{ name: 'amount', type: 'number', required: true, defaultValue: 100, description: '金额' }])
    expect(items(designer)).toHaveLength(1)
    expect(designer.validate()).toEqual([])
  })

  it('跟着设计器的语言与只读', async () => {
    setXhConfig(flowZhCN)
    const designer = await mountPreset()
    expect(table(designer).columns!.map(column => column.label)).toEqual(['变量名', '必填', '缺省值', '说明'])
    expect(cell(items(designer)[0]!, 'name').getAttribute('aria-label')).toBe('第 1 个变量的变量名')
    designer.readonly = true
    await settle(designer)
    expect([table(designer).hasAttribute('read-only'), cell(items(designer)[0]!, 'name').hasAttribute('read-only')]).toEqual([true, true])
  })

  it('宿主按编辑方式登记的编辑器换掉内建的', async () => {
    const editor: FlowPropertyEditor = () => ({ element: document.createElement('textarea') })
    const designer = await mountPreset((element) => {
      element.extensions = [createXihanWorkflow(), { id: 'host', editors: { byControl: { [XIHAN_WORKFLOW_START_VARIABLES]: editor } } }]
    })
    expect(row(designer).querySelector('xh-field-array')).toBeNull()
    expect(row(designer).querySelector('textarea')).not.toBeNull()
  })
})
