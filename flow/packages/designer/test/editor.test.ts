/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument } from '@xihan-flow/core'
import type { FlowEditorChange } from '../src/editor'
import { createNodeTypeRegistry } from '@xihan-flow/core'
import { describe, expect, it } from 'vitest'
import { createFlowEditor } from '../src/editor'

const registry = createNodeTypeRegistry([
  { type: 'start', size: { width: 100, height: 40 }, ports: 'out', entry: true, defaults: { label: '开始' } },
  { type: 'task', size: { width: 120, height: 60 }, ports: 'both', defaults: { data: { assignee: '' } } },
  { type: 'end', size: { width: 100, height: 40 }, ports: 'in', terminal: true, connection: { maxIncoming: 1 } },
])

function sample(): FlowDocument {
  return {
    version: 1,
    nodes: [
      { id: 's', type: 'start', x: 0, y: 0, width: 100, height: 40 },
      { id: 't', type: 'task', x: 200, y: 0, width: 120, height: 60, data: { assignee: 'a' } },
      { id: 'e', type: 'end', x: 400, y: 0, width: 100, height: 40 },
    ],
    edges: [
      { id: 'st', source: { node: 's' }, target: { node: 't' } },
      { id: 'te', source: { node: 't' }, target: { node: 'e' }, vertices: [{ x: 350, y: 80 }] },
    ],
  }
}

function setup(document: FlowDocument = sample()) {
  const editor = createFlowEditor({ document, registry })
  const changes: FlowEditorChange[] = []
  editor.subscribe(change => changes.push(change))
  return { editor, changes }
}

describe('新建节点与连线', () => {
  it('按类型默认值新建节点，id 不与已有重复，并选中新节点', () => {
    const { editor } = setup()
    editor.execute([{ type: 'addNode', node: { id: 'task_3', type: 'task', x: 0, y: 200, width: 1, height: 1 } }])
    const node = editor.addNode('task', { x: 10, y: 20 })
    expect(node).toEqual({ id: 'task_4', type: 'task', x: 10, y: 20, width: 120, height: 60, data: { assignee: '' } })
    expect(editor.document.nodes.at(-1)).toBe(node)
    expect(editor.selection).toEqual({ nodes: ['task_4'], edges: [] })
    expect(() => editor.addNode('missing', { x: 0, y: 0 })).toThrow(/not registered/)
  })

  it('使用方给出的 createId 优先', () => {
    let next = 0
    const editor = createFlowEditor({ document: sample(), registry, createId: (kind, type) => `${kind}:${type ?? ''}:${++next}` })
    expect(editor.addNode('start', { x: 0, y: 0 }).id).toBe('node:start:1')
    const result = editor.connect({ node: 'node:start:1' }, { node: 't' })
    expect(result.ok && result.edge.id).toBe('edge::2')
  })

  it('连接通过约束检查时新增连线并选中', () => {
    const { editor } = setup()
    const result = editor.connect({ node: 's' }, { node: 'e' })
    expect(result).toEqual({ ok: false, problems: [{ code: 'node.max-incoming', end: 'target', params: { max: 1, count: 2 } }] })
    const before = editor.document
    const other = editor.connect({ node: 'e' }, { node: 's' })
    expect(other.ok).toBe(false)
    expect(editor.document).toBe(before)

    const ok = editor.connect({ node: 's' }, { node: 't' })
    expect(ok).toEqual({ ok: true, edge: { id: 'edge_1', source: { node: 's' }, target: { node: 't' } } })
    expect(editor.selection).toEqual({ nodes: [], edges: ['edge_1'] })
  })

  it('改连一端时排除被拖动的连线本身', () => {
    const { editor } = setup()
    expect(editor.reconnect('te', 'source', { node: 's' })).toEqual({
      ok: true,
      edge: { id: 'te', source: { node: 's' }, target: { node: 'e' }, vertices: [{ x: 350, y: 80 }] },
    })
    expect(editor.reconnect('te', 'target', { node: 's' }).ok).toBe(false)
    expect(() => editor.reconnect('missing', 'target', { node: 's' })).toThrow(/does not exist/)
    editor.undo()
    expect(editor.document).toEqual(sample())
  })
})

describe('选择', () => {
  it('替换、追加与切换', () => {
    const { editor, changes } = setup()
    editor.select({ nodes: ['s', 's'] })
    editor.select({ nodes: ['t'], edges: ['st'] }, 'add')
    expect(editor.selection).toEqual({ nodes: ['s', 't'], edges: ['st'] })
    editor.select({ nodes: ['s', 'e'] }, 'toggle')
    expect(editor.selection).toEqual({ nodes: ['t', 'e'], edges: ['st'] })
    editor.select({ nodes: ['t', 'e'], edges: ['st'] })
    expect(changes).toHaveLength(3)
    editor.selectAll()
    expect(editor.selection).toEqual({ nodes: ['s', 't', 'e'], edges: ['st', 'te'] })
    editor.clearSelection()
    expect(editor.selection).toEqual({ nodes: [], edges: [] })
  })

  it('文档变化后剔除已不存在的对象', () => {
    const { editor, changes } = setup()
    editor.addNode('task', { x: 0, y: 0 })
    editor.select({ nodes: ['s', 'task_1'] })
    changes.length = 0
    editor.undo()
    expect(editor.selection).toEqual({ nodes: ['s'], edges: [] })
    expect(changes.map(change => change.kind === 'document' ? change.cause : change.kind)).toEqual(['undo', 'selection'])
  })
})

describe('删除与移动', () => {
  it('删除选中内容记为一步，撤销完整还原', () => {
    const { editor } = setup()
    editor.select({ nodes: ['t'], edges: ['st'] })
    expect(editor.deleteSelection()).toBe(true)
    expect(editor.document.nodes.map(node => node.id)).toEqual(['s', 'e'])
    expect(editor.document.edges).toEqual([])
    expect(editor.selection).toEqual({ nodes: [], edges: [] })
    expect(editor.deleteSelection()).toBe(false)
    expect(editor.history.undoCount).toBe(1)
    editor.undo()
    expect(editor.document).toEqual(sample())
  })

  it('平移一组节点，零位移不入栈', () => {
    const { editor } = setup()
    editor.moveNodes(['s', 't'], 0, 0)
    expect(editor.history.canUndo).toBe(false)
    editor.moveNodes(['s', 't'], 5, -5)
    expect(editor.document.nodes.slice(0, 2).map(node => [node.x, node.y])).toEqual([[5, -5], [205, -5]])
    expect(() => editor.moveNodes(['missing'], 1, 1)).toThrow(/does not exist/)
  })
})

describe('节点数据', () => {
  it('同一路径的连续写入不论停顿多久都合并为一步，封口后另起一步', () => {
    let time = 0
    const editor = createFlowEditor({ document: sample(), registry, now: () => time })
    editor.setNodeProperty('t', ['data', 'assignee'], 'b')
    time += 60_000
    editor.setNodeProperty('t', ['data', 'assignee'], 'bc')
    expect(editor.history.undoCount).toBe(1)
    editor.seal()
    editor.setNodeProperty('t', ['data', 'assignee'], 'bcd')
    expect(editor.history.undoCount).toBe(2)
    editor.setNodeProperty('t', ['data', 'assignee'], 'bcd')
    expect(editor.history.undoCount).toBe(2)
    editor.undo()
    expect(editor.document.nodes[1]!.data).toEqual({ assignee: 'bc' })
    editor.undo()
    expect(editor.document).toEqual(sample())
  })

  it('写入 undefined 删除键，data 变空时删除 data 字段', () => {
    const { editor } = setup()
    editor.setNodeProperty('t', ['data', 'assignee'], undefined)
    expect(editor.document.nodes[1]).not.toHaveProperty('data')
    editor.setNodeProperty('s', ['data', 'form', 'code'], 'leave')
    expect(editor.document.nodes[0]!.data).toEqual({ form: { code: 'leave' } })
  })

  it('[label] 写标签，其余不在 data 下的路径不可写', () => {
    const { editor } = setup()
    editor.setNodeProperty('t', ['label'], '审批')
    expect(editor.document.nodes[1]!.label).toBe('审批')
    editor.setNodeProperty('t', ['label'], undefined)
    expect(editor.document.nodes[1]).not.toHaveProperty('label')
    expect(() => editor.setNodeProperty('t', ['x'], 1)).toThrow(/not writable/)
    expect(() => editor.setNodeProperty('t', ['data'], {})).toThrow(/not writable/)
    expect(() => editor.setNodeProperty('t', ['label'], 1)).toThrow(/must be a string/)
  })
})

describe('连线属性', () => {
  it('写标签、外观与 data，同一路径连续写入合并，清空后删除字段', () => {
    let time = 0
    const editor = createFlowEditor({ document: sample(), registry, now: () => time })
    editor.setEdgeProperty('st', ['label'], '同')
    time += 100
    editor.setEdgeProperty('st', ['label'], '同意')
    expect(editor.history.undoCount).toBe(1)
    editor.setEdgeProperty('st', ['style', 'dashed'], true)
    editor.setEdgeProperty('st', ['data', 'condition', 'expr'], 'amount > 1')
    expect(editor.document.edges[0]).toMatchObject({ label: '同意', style: { dashed: true }, data: { condition: { expr: 'amount > 1' } } })
    expect(editor.history.undoCount).toBe(3)
    editor.setEdgeProperty('st', ['style', 'dashed'], undefined)
    editor.setEdgeProperty('st', ['label'], undefined)
    expect(editor.document.edges[0]).not.toHaveProperty('style')
    expect(editor.document.edges[0]).not.toHaveProperty('label')
  })

  it('其余路径不可写，标签必须是字符串', () => {
    const { editor } = setup()
    expect(() => editor.setEdgeProperty('st', ['source'], 's')).toThrow(/not writable/)
    expect(() => editor.setEdgeProperty('st', ['style'], {})).toThrow(/not writable/)
    expect(() => editor.setEdgeProperty('st', ['label'], 1)).toThrow(/must be a string/)
    expect(() => editor.setEdgeProperty('missing', ['label'], 'x')).toThrow(/does not exist/)
  })
})

describe('复制与粘贴', () => {
  it('粘贴出新 id，只带两端都被复制的连线，逐次累加偏移', () => {
    const { editor } = setup()
    editor.select({ nodes: ['s', 't'] })
    expect(editor.copy()).toEqual({ nodes: sample().nodes.slice(0, 2), edges: [sample().edges[0]] })
    const first = editor.paste()
    expect(first).toEqual({ nodes: ['start_1', 'task_1'], edges: ['edge_1'] })
    expect(editor.selection).toEqual(first)
    expect(editor.document.edges.at(-1)).toEqual({ id: 'edge_1', source: { node: 'start_1' }, target: { node: 'task_1' } })
    expect(editor.document.nodes.slice(-2).map(node => [node.x, node.y])).toEqual([[24, 24], [224, 24]])
    editor.paste()
    expect(editor.document.nodes.slice(-2).map(node => [node.id, node.x, node.y])).toEqual([['start_2', 48, 48], ['task_2', 248, 48]])
    expect(editor.history.undoCount).toBe(2)
  })

  it('复制带拐点的连线时拐点随之偏移；给出剪贴板时只偏移一次', () => {
    const { editor } = setup()
    editor.select({ nodes: ['t', 'e'] })
    const clipboard = editor.copy()!
    editor.paste(clipboard, { offset: 10 })
    editor.paste(clipboard, { offset: 10 })
    expect(editor.document.edges.filter(edge => edge.vertices).map(edge => edge.vertices)).toEqual([
      [{ x: 350, y: 80 }],
      [{ x: 360, y: 90 }],
      [{ x: 360, y: 90 }],
    ])
  })

  it('原地复制不改剪贴板，没有选中节点时什么都不做', () => {
    const { editor } = setup()
    expect(editor.paste()).toEqual({ nodes: [], edges: [] })
    expect(editor.duplicate()).toEqual({ nodes: [], edges: [] })
    editor.select({ nodes: ['s'] })
    editor.copy()
    editor.select({ nodes: ['e'] })
    expect(editor.duplicate()).toEqual({ nodes: ['end_1'], edges: [] })
    expect(editor.paste()).toEqual({ nodes: ['start_1'], edges: [] })
  })
})

describe('排列', () => {
  it('对齐与分布选中的节点', () => {
    const { editor } = setup()
    editor.select({ nodes: ['s'] })
    editor.align('bottom')
    expect(editor.history.canUndo).toBe(false)
    editor.select({ nodes: ['s', 't', 'e'] })
    editor.align('bottom')
    expect(editor.document.nodes.map(node => node.y + node.height)).toEqual([60, 60, 60])
    editor.execute([{ type: 'moveNodes', positions: [{ id: 't', x: 120, y: 0 }] }])
    editor.distribute('horizontal')
    expect(editor.document.nodes.map(node => node.x)).toEqual([0, 190, 400])
  })

  it('自动布局按连线分层，保持左上角并清除手动拐点，记为一步', () => {
    const { editor } = setup({
      ...sample(),
      nodes: sample().nodes.map(node => ({ ...node, x: node.x + 50, y: node.y + 30 })),
    })
    editor.autoLayout({ direction: 'TB', layerGap: 40 })
    const [s, t, e] = editor.document.nodes
    expect(Math.min(s!.x, t!.x, e!.x)).toBe(50)
    expect(s!.y).toBe(30)
    expect(t!.y).toBe(s!.y + 40 + 40)
    expect(e!.y).toBe(t!.y + 60 + 40)
    expect(editor.document.edges.every(edge => edge.vertices === undefined)).toBe(true)
    expect(editor.history.undoCount).toBe(1)
    createFlowEditor({ document: { version: 1, nodes: [], edges: [] }, registry }).autoLayout()
  })
})

describe('装载与校验', () => {
  it('装载新文档清空历史与选择', () => {
    const { editor } = setup()
    editor.addNode('task', { x: 0, y: 0 })
    editor.load(sample())
    expect(editor.history.canUndo).toBe(false)
    expect(editor.selection).toEqual({ nodes: [], edges: [] })
    expect(editor.document).toEqual(sample())
  })

  it('按当前登记表校验', () => {
    const { editor } = setup()
    expect(editor.validate()).toEqual([])
    editor.setRegistry(createNodeTypeRegistry([]))
    expect(editor.validate().map(issue => issue.code)).toContain('node.unknown-type')
  })
})
