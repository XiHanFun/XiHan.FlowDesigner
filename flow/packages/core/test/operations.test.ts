/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowEdge, FlowNode, FlowOperation, FlowOperationResult } from '../src'
import { describe, expect, it } from 'vitest'
import { applyOperation, applyOperations, FlowOperationError } from '../src'

function node(id: string, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type: 'task', x: 0, y: 0, width: 100, height: 40, ...extra }
}

function edge(id: string, source: string, target: string, extra: Partial<FlowEdge> = {}): FlowEdge {
  return { id, source: { node: source }, target: { node: target }, ...extra }
}

function sample(): FlowDocument {
  return {
    version: 1,
    nodes: [node('a', { label: 'A', data: { k: 1 } }), node('b', { x: 200 }), node('c', { x: 400 })],
    edges: [
      edge('ab', 'a', 'b', { label: 'go', style: { dashed: true } }),
      edge('bc', 'b', 'c', { data: { priority: 1 }, vertices: [{ x: 300, y: 0 }] }),
      edge('ca', 'c', 'a'),
      edge('bb', 'b', 'b'),
    ],
    data: { code: 'flow' },
  }
}

/** 应用操作后再应用逆操作，断言回到原文档；返回正向结果。 */
function roundTrip(document: FlowDocument, operations: readonly FlowOperation[]): FlowOperationResult {
  const snapshot = JSON.stringify(document)
  const forward = applyOperations(document, operations)
  expect(JSON.stringify(document)).toBe(snapshot)
  const backward = applyOperations(forward.document, forward.inverse)
  expect(backward.document).toEqual(document)
  const again = applyOperations(backward.document, backward.inverse)
  expect(again.document).toEqual(forward.document)
  return forward
}

function errorOf(fn: () => unknown): FlowOperationError {
  try {
    fn()
  }
  catch (error) {
    if (error instanceof FlowOperationError)
      return error
    throw error
  }
  throw new Error('expected FlowOperationError')
}

describe('节点操作', () => {
  it('addNode 追加或插入到指定位置', () => {
    const appended = roundTrip(sample(), [{ type: 'addNode', node: node('d') }])
    expect(appended.document.nodes.map(item => item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(appended.inverse).toEqual([{ type: 'removeNode', id: 'd' }])
    const inserted = roundTrip(sample(), [{ type: 'addNode', node: node('d'), index: 0 }])
    expect(inserted.document.nodes.map(item => item.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('addNode 拒绝重复 id 与越界位置', () => {
    expect(errorOf(() => applyOperation(sample(), { type: 'addNode', node: node('a') })).code).toBe('duplicate-id')
    expect(errorOf(() => applyOperation(sample(), { type: 'addNode', node: node('d'), index: 4 })).code).toBe('invalid-operation')
    expect(errorOf(() => applyOperation(sample(), { type: 'addNode', node: node('d'), index: 0.5 })).code).toBe('invalid-operation')
  })

  it('removeNode 级联删除相连的连线，逆操作放回原位置', () => {
    const result = roundTrip(sample(), [{ type: 'removeNode', id: 'b' }])
    expect(result.document.nodes.map(item => item.id)).toEqual(['a', 'c'])
    expect(result.document.edges.map(item => item.id)).toEqual(['ca'])
    expect(result.inverse.map(operation => operation.type)).toEqual(['addNode', 'addEdge', 'addEdge', 'addEdge'])
    expect(result.inverse.slice(1).map(operation => operation.type === 'addEdge' && [operation.edge.id, operation.index])).toEqual([['ab', 0], ['bc', 1], ['bb', 3]])
  })

  it('removeNode 不存在时报错', () => {
    expect(errorOf(() => applyOperation(sample(), { type: 'removeNode', id: 'x' })).code).toBe('node-not-found')
  })

  it('addNode 的逆操作保留原本指向该 id 的悬空连线', () => {
    const dangling: FlowDocument = { version: 1, nodes: [node('a')], edges: [edge('ax', 'a', 'x'), edge('aa', 'a', 'a')] }
    const result = roundTrip(dangling, [{ type: 'addNode', node: node('x') }])
    expect(result.inverse).toEqual([{ type: 'removeNode', id: 'x' }, { type: 'addEdge', edge: dangling.edges[0], index: 0 }])
  })

  it('moveNodes 批量移动，逆操作恢复原坐标', () => {
    const result = roundTrip(sample(), [{ type: 'moveNodes', positions: [{ id: 'c', x: 1, y: 2 }, { id: 'a', x: 3, y: 4 }] }])
    expect(result.document.nodes.map(item => [item.id, item.x, item.y])).toEqual([['a', 3, 4], ['b', 200, 0], ['c', 1, 2]])
    expect(result.inverse).toEqual([{ type: 'moveNodes', positions: [{ id: 'c', x: 400, y: 0 }, { id: 'a', x: 0, y: 0 }] }])
  })

  it('moveNodes 未改动的节点沿用原引用，空列表不改文档', () => {
    const document = sample()
    const result = applyOperation(document, { type: 'moveNodes', positions: [{ id: 'a', x: 9, y: 9 }] })
    expect(result.document.nodes[1]).toBe(document.nodes[1])
    expect(result.document.edges).toBe(document.edges)
    expect(applyOperation(document, { type: 'moveNodes', positions: [] }).document).toBe(document)
  })

  it('moveNodes 拒绝重复、不存在与非有限坐标', () => {
    expect(errorOf(() => applyOperation(sample(), { type: 'moveNodes', positions: [{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 1, y: 1 }] })).code).toBe('invalid-operation')
    expect(errorOf(() => applyOperation(sample(), { type: 'moveNodes', positions: [{ id: 'x', x: 0, y: 0 }] })).code).toBe('node-not-found')
    expect(errorOf(() => applyOperation(sample(), { type: 'moveNodes', positions: [{ id: 'a', x: Number.NaN, y: 0 }] })).code).toBe('invalid-operation')
  })

  it('resizeNode 改尺寸与位置', () => {
    const result = roundTrip(sample(), [{ type: 'resizeNode', id: 'b', x: 190, y: -10, width: 120, height: 60 }])
    expect(result.document.nodes[1]).toEqual(node('b', { x: 190, y: -10, width: 120, height: 60 }))
    expect(result.inverse).toEqual([{ type: 'resizeNode', id: 'b', x: 200, y: 0, width: 100, height: 40 }])
    expect(errorOf(() => applyOperation(sample(), { type: 'resizeNode', id: 'b', x: 0, y: 0, width: -1, height: 1 })).code).toBe('invalid-operation')
    expect(errorOf(() => applyOperation(sample(), { type: 'resizeNode', id: 'x', x: 0, y: 0, width: 1, height: 1 })).code).toBe('node-not-found')
  })

  it('updateNode 改 label 与 data，null 删除字段', () => {
    const result = roundTrip(sample(), [{ type: 'updateNode', id: 'a', patch: { label: null, data: { k: 2 } } }])
    expect(result.document.nodes[0]).toEqual(node('a', { data: { k: 2 } }))
    expect(result.inverse).toEqual([{ type: 'updateNode', id: 'a', patch: { label: 'A', data: { k: 1 } } }])
    const added = roundTrip(sample(), [{ type: 'updateNode', id: 'b', patch: { label: 'B' } }])
    expect(added.inverse).toEqual([{ type: 'updateNode', id: 'b', patch: { label: null } }])
  })

  it('updateNode 拒绝补丁中的未登记字段', () => {
    const error = errorOf(() => applyOperation(sample(), { type: 'updateNode', id: 'a', patch: { id: 'z' } as never }))
    expect(error.code).toBe('invalid-operation')
    expect(error.message).toContain('"id"')
  })
})

describe('连线操作', () => {
  it('addEdge / removeEdge 保持位置', () => {
    const added = roundTrip(sample(), [{ type: 'addEdge', edge: edge('ac', 'a', 'c'), index: 1 }])
    expect(added.document.edges.map(item => item.id)).toEqual(['ab', 'ac', 'bc', 'ca', 'bb'])
    const removed = roundTrip(sample(), [{ type: 'removeEdge', id: 'bc' }])
    expect(removed.inverse).toEqual([{ type: 'addEdge', edge: sample().edges[1], index: 1 }])
    expect(errorOf(() => applyOperation(sample(), { type: 'addEdge', edge: edge('ab', 'a', 'b') })).code).toBe('duplicate-id')
    expect(errorOf(() => applyOperation(sample(), { type: 'removeEdge', id: 'zz' })).code).toBe('edge-not-found')
  })

  it('reconnectEdge 只改给出的端，逆操作只恢复这些端', () => {
    const result = roundTrip(sample(), [{ type: 'reconnectEdge', id: 'ab', target: { node: 'c', port: 'in' } }])
    expect(result.document.edges[0]).toEqual(edge('ab', 'a', 'c', { label: 'go', style: { dashed: true }, target: { node: 'c', port: 'in' } }))
    expect(result.inverse).toEqual([{ type: 'reconnectEdge', id: 'ab', target: { node: 'b' } }])
    roundTrip(sample(), [{ type: 'reconnectEdge', id: 'ab', source: { node: 'c' }, target: { node: 'a' } }])
    expect(errorOf(() => applyOperation(sample(), { type: 'reconnectEdge', id: 'ab' })).code).toBe('invalid-operation')
  })

  it('updateEdge 改标签、样式、数据与折点', () => {
    const result = roundTrip(sample(), [{
      type: 'updateEdge',
      id: 'bc',
      patch: { label: 'x', style: { dashed: false }, data: null, vertices: null },
    }])
    expect(result.document.edges[1]).toEqual(edge('bc', 'b', 'c', { label: 'x', style: { dashed: false } }))
    expect(result.inverse).toEqual([{
      type: 'updateEdge',
      id: 'bc',
      patch: { label: null, style: null, data: { priority: 1 }, vertices: [{ x: 300, y: 0 }] },
    }])
    expect(errorOf(() => applyOperation(sample(), { type: 'updateEdge', id: 'bc', patch: { source: { node: 'a' } } as never })).code).toBe('invalid-operation')
  })
})

describe('文档操作', () => {
  it('updateDocument 改文档级 data', () => {
    const result = roundTrip(sample(), [{ type: 'updateDocument', patch: { data: { code: 'next' } } }])
    expect(result.document.data).toEqual({ code: 'next' })
    roundTrip(sample(), [{ type: 'updateDocument', patch: { data: null } }])
  })

  it('未知操作类型报错', () => {
    expect(errorOf(() => applyOperation(sample(), { type: 'explode' } as never)).code).toBe('invalid-operation')
  })
})

describe('没有带来变化的操作', () => {
  it.each<[string, FlowOperation]>([
    ['移到原位', { type: 'moveNodes', positions: [{ id: 'a', x: 0, y: 0 }] }],
    ['空移动', { type: 'moveNodes', positions: [] }],
    ['尺寸不变', { type: 'resizeNode', id: 'b', x: 200, y: 0, width: 100, height: 40 }],
    ['标签与数据相同', { type: 'updateNode', id: 'a', patch: { label: 'A', data: { k: 1 } } }],
    ['删除本来没有的字段', { type: 'updateNode', id: 'b', patch: { label: null, data: null } }],
    ['空补丁', { type: 'updateEdge', id: 'ab', patch: {} }],
    ['连线属性相同', { type: 'updateEdge', id: 'bc', patch: { data: { priority: 1 }, vertices: [{ x: 300, y: 0 }] } }],
    ['端点相同', { type: 'reconnectEdge', id: 'ab', source: { node: 'a' }, target: { node: 'b' } }],
    ['文档数据相同', { type: 'updateDocument', patch: { data: { code: 'flow' } } }],
  ])('%s：返回同一文档、逆操作为空', (_, operation) => {
    const document = sample()
    expect(applyOperation(document, operation)).toEqual({ document, inverse: [] })
    expect(applyOperation(document, operation).document).toBe(document)
  })

  it('批量移动只记下真正移动了的节点', () => {
    const result = applyOperation(sample(), { type: 'moveNodes', positions: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5, y: 5 }] })
    expect(result.inverse).toEqual([{ type: 'moveNodes', positions: [{ id: 'b', x: 200, y: 0 }] }])
  })

  it('补丁的逆操作只含真正变了的字段', () => {
    const result = applyOperation(sample(), { type: 'updateNode', id: 'a', patch: { label: 'A', data: { k: 2 } } })
    expect(result.inverse).toEqual([{ type: 'updateNode', id: 'a', patch: { data: { k: 1 } } }])
    const reconnect = applyOperation(sample(), { type: 'reconnectEdge', id: 'ab', source: { node: 'a' }, target: { node: 'c' } })
    expect(reconnect.inverse).toEqual([{ type: 'reconnectEdge', id: 'ab', target: { node: 'b' } }])
  })

  it('一组操作都没有变化时返回同一文档', () => {
    const document = sample()
    const result = applyOperations(document, [{ type: 'moveNodes', positions: [] }, { type: 'updateEdge', id: 'ab', patch: { label: 'go' } }])
    expect(result.document).toBe(document)
    expect(result.inverse).toEqual([])
  })
})

describe('applyOperations', () => {
  it('逆操作按反序拼接', () => {
    const result = roundTrip(sample(), [
      { type: 'addNode', node: node('d') },
      { type: 'addEdge', edge: edge('cd', 'c', 'd') },
      { type: 'moveNodes', positions: [{ id: 'd', x: 10, y: 10 }] },
    ])
    expect(result.inverse.map(operation => operation.type)).toEqual(['moveNodes', 'removeEdge', 'removeNode'])
  })

  it('中途失败时抛错且不影响输入文档', () => {
    const document = sample()
    const snapshot = JSON.stringify(document)
    expect(() => applyOperations(document, [{ type: 'removeNode', id: 'a' }, { type: 'removeNode', id: 'a' }])).toThrow(FlowOperationError)
    expect(JSON.stringify(document)).toBe(snapshot)
  })

  it('错误携带失败的操作', () => {
    const operation: FlowOperation = { type: 'removeEdge', id: 'none' }
    const error = errorOf(() => applyOperations(sample(), [operation]))
    expect(error.operation).toBe(operation)
    expect(error.name).toBe('FlowOperationError')
  })
})

describe('随机操作序列', () => {
  function random(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  function randomOperation(document: FlowDocument, next: () => number, counter: { value: number }): FlowOperation {
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
    const nodes = document.nodes
    const edges = document.edges
    const kinds = ['addNode', 'addNode', 'addEdge', 'addEdge', 'moveNodes', 'updateNode', 'updateEdge', 'updateDocument']
    if (nodes.length > 0)
      kinds.push('removeNode', 'resizeNode')
    if (edges.length > 0)
      kinds.push('removeEdge', 'reconnectEdge')
    const kind = pick(kinds)
    const id = `g${counter.value++}`
    const someNode = (): string => nodes.length > 0 ? pick(nodes).id : id
    switch (kind) {
      case 'addNode':
        return { type: 'addNode', node: node(id, { x: next() * 500 }), index: Math.floor(next() * (nodes.length + 1)) }
      case 'addEdge':
        return { type: 'addEdge', edge: edge(id, someNode(), someNode()), index: Math.floor(next() * (edges.length + 1)) }
      case 'moveNodes':
        return { type: 'moveNodes', positions: nodes.filter(() => next() < 0.5).map(item => ({ id: item.id, x: next() * 100, y: next() * 100 })) }
      case 'updateNode':
        return nodes.length > 0 ? { type: 'updateNode', id: pick(nodes).id, patch: next() < 0.5 ? { label: null } : { label: id, data: { n: next() } } } : { type: 'updateDocument', patch: {} }
      case 'updateEdge':
        return edges.length > 0 ? { type: 'updateEdge', id: pick(edges).id, patch: { vertices: next() < 0.5 ? null : [{ x: 1, y: 2 }], style: { dashed: next() < 0.5 } } } : { type: 'updateDocument', patch: { data: null } }
      case 'updateDocument':
        return { type: 'updateDocument', patch: { data: next() < 0.3 ? null : { v: next() } } }
      case 'removeNode':
        return { type: 'removeNode', id: pick(nodes).id }
      case 'resizeNode':
        return { type: 'resizeNode', id: pick(nodes).id, x: 1, y: 2, width: next() * 50, height: next() * 50 }
      case 'removeEdge':
        return { type: 'removeEdge', id: pick(edges).id }
      default:
        return { type: 'reconnectEdge', id: pick(edges).id, ...(next() < 0.5 ? { source: { node: someNode() } } : { target: { node: someNode(), port: 'p' } }) }
    }
  }

  it.each([1, 2, 3, 4, 5])('种子 %i：每一步与整批逆操作都能精确回到原状态', (seed) => {
    const next = random(seed)
    const counter = { value: 0 }
    const history: { before: FlowDocument, inverse: readonly FlowOperation[] }[] = []
    let document = sample()
    const all: FlowOperation[] = []
    for (let step = 0; step < 60; step++) {
      const operation = randomOperation(document, next, counter)
      const result = applyOperation(document, operation)
      expect(applyOperations(result.document, result.inverse).document).toEqual(document)
      history.push({ before: document, inverse: result.inverse })
      all.push(operation)
      document = result.document
    }
    for (const entry of history.reverse()) {
      document = applyOperations(document, entry.inverse).document
      expect(document).toEqual(entry.before)
    }
    roundTrip(sample(), all)
  })
})
