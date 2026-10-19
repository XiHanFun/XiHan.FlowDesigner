/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { JsonValue } from '@xihan-ui/core/json'
import type { XhDesignerJsonEditorElement } from '@xihan-ui/designer-shell'
import type { XhFlowDesigner } from '../src'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFlowDesigner, flowMenuLayout } from '../src'
import { mount, part, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(unmountAll)

function editor(designer: XhFlowDesigner): XhDesignerJsonEditorElement {
  return designer.querySelector('xh-designer-json-editor')!
}

function apply(designer: XhFlowDesigner, value: JsonValue): void {
  editor(designer).dispatchEvent(new CustomEvent('json-apply', { detail: { value }, bubbles: true }))
}

describe('编辑 JSON', () => {
  it('按 Ctrl / ⌘ + Shift + J 打开对话框，写出当前流程定义；空白处的右键菜单末尾也有这一条', async () => {
    const designer = await mount()
    part(designer, 'viewport')[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))
    await designer.updateComplete
    expect([editor(designer).open, editor(designer).value, editor(designer).readonly]).toEqual([true, designer.schema, false])
    expect(flowMenuLayout('blank', 0).at(-1)).toEqual(['edit-json'])
  })

  it('按读入检查与校验报问题：说明与所在对象的名字同问题列表；结构读不了时报读入的问题', async () => {
    const designer = await mount()
    designer.openJsonEditor()
    const validate = editor(designer).validate!
    const clean = validate(designer.schema as unknown as JsonValue)
    expect(clean.every(item => item.issue.code.startsWith('node.') || item.issue.code.startsWith('type.'))).toBe(true)
    const twin = structuredClone(designer.schema) as unknown as { nodes: { id: string }[] }
    twin.nodes[1]!.id = 's'
    const items = validate(twin as unknown as JsonValue)
    expect(items.some(item => item.issue.code === 'node.duplicate-id' && item.message === 'Node id "s" is used more than once')).toBe(true)
    const shapeless = validate({ nodes: 'x' })
    expect([shapeless.length > 0, shapeless.every(item => item.subject === 'Flow')]).toEqual([true, true])
  })

  it('应用时整份换上，记一步撤销，派发 schema-change 并清空选择；撤销回到原来那份', async () => {
    const designer = await mount()
    const before = designer.schema
    designer.select({ nodes: ['s'] })
    const kinds: string[] = []
    designer.addEventListener('schema-change', event => kinds.push((event as CustomEvent<{ kind: string }>).detail.kind))
    const next = { ...structuredClone(before), nodes: before.nodes.slice(0, 2).map(node => ({ ...node })), edges: [] }
    apply(designer, next as unknown as JsonValue)
    await designer.updateComplete
    expect([designer.schema.nodes.map(node => node.id), designer.schema.edges, kinds, designer.getSelection()]).toEqual([['s', 't'], [], ['execute'], { nodes: [], edges: [] }])
    expect(designer.undo()).toBe(true)
    expect(designer.schema).toEqual(before)
  })

  it('只读时只能看：对话框只读，应用不改流程定义', async () => {
    const designer = await mount(element => (element.readonly = true))
    designer.openJsonEditor()
    expect(editor(designer).readonly).toBe(true)
    const before = designer.schema
    apply(designer, { ...structuredClone(before), nodes: [] } as unknown as JsonValue)
    expect(designer.schema).toBe(before)
  })
})
