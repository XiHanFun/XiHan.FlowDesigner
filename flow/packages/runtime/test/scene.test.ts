/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowRouteRequest } from '@xihan-flow/core'
import { createNodeTypeRegistry } from '@xihan-flow/core'
import { describe, expect, it } from 'vitest'
import { arrowPath, buildScene, polylinePath } from '../src'

const registry = createNodeTypeRegistry([
  { type: 'task', label: '任务', size: { width: 100, height: 40 }, ports: 'both' },
  { type: 'note', size: { width: 50, height: 50 }, ports: 'none' },
])

const document: FlowDocument = {
  version: 1,
  nodes: [
    { id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40, label: '开始审批' },
    { id: 'b', type: 'task', x: 200, y: 0, width: 100, height: 40 },
    { id: 'c', type: 'ghost', x: 0, y: 100, width: 60, height: 30 },
    { id: 'n', type: 'note', x: 0, y: 200, width: 50, height: 50 },
  ],
  edges: [
    { id: 'ab', source: { node: 'a' }, target: { node: 'b' }, label: '同意', style: { dashed: true } },
    { id: 'ba', source: { node: 'b' }, target: { node: 'a' }, vertices: [{ x: 320, y: 20 }, { x: 320, y: -60 }, { x: -20, y: -60 }, { x: -20, y: 20 }] },
    { id: 'an', source: { node: 'a' }, target: { node: 'n' } },
  ],
}

function straight(request: FlowRouteRequest) {
  return [request.source.point, request.target.point]
}

describe('buildScene', () => {
  it('节点框、标签、状态与高亮', () => {
    const scene = buildScene(document, registry, { route: straight, statuses: { a: 'running', b: null }, highlighted: ['b'] })
    expect(scene.nodes.map(node => [node.id, node.label, node.status, node.highlighted])).toEqual([
      ['a', '开始审批', 'running', false],
      ['b', '任务', undefined, true],
      ['c', 'c', undefined, false],
      ['n', 'n', undefined, false],
    ])
    expect(scene.nodes[0]!.rect).toEqual({ x: 0, y: 0, width: 100, height: 40 })
    expect(scene.nodes[2]!.nodeType).toBeUndefined()
  })

  it('连线路径在终点让出箭头，箭头尖端在端口上', () => {
    const scene = buildScene(document, registry, { route: straight, arrowSize: 10 })
    const ab = scene.edges[0]!
    expect(ab.points).toEqual([{ x: 100, y: 20 }, { x: 200, y: 20 }])
    expect(ab.path).toBe('M100,20 L190,20')
    expect(ab.arrow).toBe('M200,20 L190,25 L190,15 Z')
    expect([ab.label, ab.dashed]).toEqual(['同意', true])
    expect(ab.labelPoint).toEqual({ x: 150, y: 20 })
  })

  it('带折点的连线穿过折点并倒圆角', () => {
    const scene = buildScene(document, registry, { route: straight, arrowSize: 0, cornerRadius: 10 })
    const ba = scene.edges[1]!
    expect(ba.points).toHaveLength(6)
    expect(ba.path.startsWith('M300,20 L310,20 Q320,20 320,10')).toBe(true)
    expect(ba.arrow).toBe('')
    expect([ba.label, ba.dashed]).toEqual([undefined, false])
  })

  it('端点解析不出的连线不画', () => {
    const an = buildScene(document, registry, { route: straight }).edges[2]!
    expect([an.anchored, an.path, an.arrow, an.labelPoint]).toEqual([false, '', '', undefined])
  })

  it('包围盒含节点与折线', () => {
    expect(buildScene(document, registry, { route: straight }).bounds).toEqual({ x: -20, y: -60, width: 340, height: 310 })
    expect(buildScene({ version: 1, nodes: [], edges: [] }, registry, { route: straight }).bounds).toBeUndefined()
  })
})

describe('路径工具', () => {
  it('折线转 SVG path，圆角半径不超过相邻段长度的一半', () => {
    expect(polylinePath([])).toBe('')
    expect(polylinePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }], 6)).toBe('M0,0 L8,0 Q10,0 10,2 L10,4')
    expect(polylinePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe('M0,0 L10,0 L10,10')
  })

  it('箭头沿最后一段方向，忽略与终点重合的点', () => {
    expect(arrowPath([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 10 }], 4)).toBe('M0,10 L-2,6 L2,6 Z')
    expect(arrowPath([{ x: 5, y: 5 }], 4)).toBe('')
  })
})
