/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowRouteRequest } from '../src'
import { describe, expect, it, vi } from 'vitest'
import { computeEdgeGeometry, createNodeTypeRegistry, polylineMidpoint, resolveEdgeAnchor } from '../src'

const registry = createNodeTypeRegistry([
  { type: 'task', size: { width: 100, height: 40 }, ports: 'both' },
  {
    type: 'gate',
    size: { width: 40, height: 40 },
    ports: [
      { id: 'in', direction: 'in', side: 'top' },
      { id: 'yes', direction: 'out', side: 'bottom', offset: 0.25 },
    ],
  },
  { type: 'note', size: { width: 50, height: 50 }, ports: 'none' },
])

const document: FlowDocument = {
  version: 1,
  nodes: [
    { id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40 },
    { id: 'g', type: 'gate', x: 200, y: 100, width: 40, height: 40 },
    { id: 'n', type: 'note', x: -50, y: 300, width: 50, height: 50 },
  ],
  edges: [
    { id: 'ag', source: { node: 'a' }, target: { node: 'g', port: 'in' } },
    { id: 'gb', source: { node: 'g', port: 'yes' }, target: { node: 'a' }, vertices: [{ x: 210, y: 400 }, { x: -20, y: 400 }] },
    { id: 'an', source: { node: 'a' }, target: { node: 'n' } },
    { id: 'ax', source: { node: 'a' }, target: { node: 'missing' } },
  ],
}

describe('resolveEdgeAnchor', () => {
  it('按端口给出位置与方向', () => {
    expect(resolveEdgeAnchor(document, registry, { node: 'a' }, 'source')).toEqual({ point: { x: 100, y: 20 }, side: 'right' })
    expect(resolveEdgeAnchor(document, registry, { node: 'a' }, 'target')).toEqual({ point: { x: 0, y: 20 }, side: 'left' })
    expect(resolveEdgeAnchor(document, registry, { node: 'g', port: 'yes' }, 'source')).toEqual({ point: { x: 210, y: 140 }, side: 'bottom' })
  })

  it('节点不存在、类型未知或没有可用端口时为 undefined', () => {
    expect(resolveEdgeAnchor(document, registry, { node: 'missing' }, 'source')).toBeUndefined()
    expect(resolveEdgeAnchor(document, registry, { node: 'n' }, 'target')).toBeUndefined()
    expect(resolveEdgeAnchor({ ...document, nodes: [{ id: 'z', type: 'ghost', x: 0, y: 0, width: 1, height: 1 }] }, registry, { node: 'z' }, 'source')).toBeUndefined()
  })
})

describe('computeEdgeGeometry', () => {
  it('无折点的连线交给路由器，带折点的穿过折点，端点解析不出的为空', () => {
    const route = vi.fn((request: FlowRouteRequest) => [request.source.point, { x: 150, y: 20 }, { x: 150, y: 80 }, request.target.point])
    const geometry = computeEdgeGeometry(document, registry, route)
    expect(geometry).toEqual([
      { id: 'ag', index: 0, anchored: true, points: [{ x: 100, y: 20 }, { x: 150, y: 20 }, { x: 150, y: 80 }, { x: 220, y: 100 }] },
      { id: 'gb', index: 1, anchored: true, points: [{ x: 210, y: 140 }, { x: 210, y: 400 }, { x: -20, y: 400 }, { x: 0, y: 20 }] },
      { id: 'an', index: 2, anchored: false, points: [] },
      { id: 'ax', index: 3, anchored: false, points: [] },
    ])
    expect(route).toHaveBeenCalledTimes(1)
    const request = route.mock.calls[0]![0]
    expect(request.edge.id).toBe('ag')
    expect(request.target).toEqual({ point: { x: 220, y: 100 }, side: 'top' })
    expect(request.obstacles).toEqual(document.nodes.map(({ x, y, width, height }) => ({ x, y, width, height })))
  })
})

describe('polylineMidpoint', () => {
  it('取折线总长一半处', () => {
    expect(polylineMidpoint([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }])).toEqual({ x: 10, y: 10 })
    expect(polylineMidpoint([{ x: 5, y: 5 }])).toEqual({ x: 5, y: 5 })
    expect(polylineMidpoint([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toEqual({ x: 1, y: 1 })
    expect(polylineMidpoint([])).toBeUndefined()
  })
})
