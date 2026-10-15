/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 连线几何：端点落在哪个端口、从哪一边离开，连线的折线（有折点时穿过折点，否则交给注入的路由器），
// 折线上标签的位置，以及整张图的包围盒。

import type { FlowEdgeEnd } from './issues'
import type { FlowNodeTypeRegistry, FlowPortSide } from './registry'
import type { FlowDocument, FlowEdge, FlowEndpoint, FlowNode, FlowPoint, FlowRect } from './schema'
import { getPortPosition } from './registry'
import { resolveEndpointPort } from './validate'

/** 连线的一端：端口位置与离开（起点）或进入（终点）节点的那一边。 */
export interface FlowEdgeAnchor {
  readonly point: FlowPoint
  readonly side: FlowPortSide
}

/** 路由器的输入：两端锚点与要绕开的节点框。 */
export interface FlowRouteRequest {
  readonly edge: FlowEdge
  readonly source: FlowEdgeAnchor
  readonly target: FlowEdgeAnchor
  readonly obstacles: readonly FlowRect[]
}

/** 路由器：给出从起点锚点到终点锚点的完整折线（含两端）。 */
export type FlowEdgeRouter = (request: FlowRouteRequest) => readonly FlowPoint[]

/** 一条连线的几何；端点解析不出时 points 为空、anchored 为 false。 */
export interface FlowEdgeGeometry {
  readonly id: string
  readonly index: number
  readonly anchored: boolean
  readonly points: readonly FlowPoint[]
}

/** 解析连线一端的锚点；节点不存在、类型未知或没有可用端口时返回 undefined。 */
export function resolveEdgeAnchor(
  document: FlowDocument,
  registry: FlowNodeTypeRegistry,
  endpoint: FlowEndpoint,
  end: FlowEdgeEnd,
): FlowEdgeAnchor | undefined {
  const node = document.nodes.find(item => item.id === endpoint.node)
  const nodeType = node && registry.get(node.type)
  if (!node || !nodeType)
    return undefined
  const port = resolveEndpointPort(nodeType, endpoint, end)
  if (!port)
    return undefined
  return { point: getPortPosition(node, port), side: port.side }
}

/**
 * 求全部连线的折线：带折点的连线依次穿过折点，其余交给 route；两端都以端口位置为起止。
 * 交给 route 的障碍物是全部节点框，与 route 自己绕开端点所在节点的约定一致。
 */
export function computeEdgeGeometry(
  document: FlowDocument,
  registry: FlowNodeTypeRegistry,
  route: FlowEdgeRouter,
): FlowEdgeGeometry[] {
  const obstacles = document.nodes.map(nodeRect)
  return document.edges.map((edge, index) => {
    const source = resolveEdgeAnchor(document, registry, edge.source, 'source')
    const target = resolveEdgeAnchor(document, registry, edge.target, 'target')
    if (!source || !target)
      return { id: edge.id, index, anchored: false, points: [] }
    const points = edge.vertices && edge.vertices.length > 0
      ? [source.point, ...edge.vertices, target.point]
      : route({ edge, source, target, obstacles })
    return { id: edge.id, index, anchored: true, points }
  })
}

/** 折线总长一半处的点，用作标签位置；空折线返回 undefined。 */
export function polylineMidpoint(points: readonly FlowPoint[]): FlowPoint | undefined {
  if (points.length === 0)
    return undefined
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
    lengths.push(length)
    total += length
  }
  let remaining = total / 2
  for (let i = 1; i < points.length; i++) {
    const length = lengths[i - 1]!
    if (remaining <= length && length > 0) {
      const t = remaining / length
      const a = points[i - 1]!
      const b = points[i]!
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= length
  }
  return points[points.length - 1]
}

/** 包住全部节点与连线折点的矩形；空文档返回 undefined。 */
export function getDocumentBounds(document: FlowDocument): FlowRect | undefined {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const node of document.nodes) {
    x0 = Math.min(x0, node.x)
    y0 = Math.min(y0, node.y)
    x1 = Math.max(x1, node.x + node.width)
    y1 = Math.max(y1, node.y + node.height)
  }
  for (const edge of document.edges) {
    for (const vertex of edge.vertices ?? []) {
      x0 = Math.min(x0, vertex.x)
      y0 = Math.min(y0, vertex.y)
      x1 = Math.max(x1, vertex.x)
      y1 = Math.max(y1, vertex.y)
    }
  }
  return x0 === Infinity ? undefined : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

function nodeRect(node: FlowNode): FlowRect {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}
