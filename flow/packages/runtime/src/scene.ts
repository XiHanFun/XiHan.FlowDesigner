/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 查看器的场景：把文档、节点类型与运行状态算成可直接绘制的节点框、连线路径、箭头与标签位置，不碰 DOM。

import type { FlowDocument, FlowEdge, FlowEdgeRouter, FlowNode, FlowNodeType, FlowNodeTypeRegistry, FlowPoint, FlowRect } from '@xihan-flow/core'
import { computeEdgeGeometry, polylineMidpoint } from '@xihan-flow/core'
import { unionRects } from '@xihan-ui/designer-kit'
import { createSvgPath } from '@xihan-ui/viz'

/** 节点运行状态；内置样式覆盖 running / completed / faulted / waiting / canceled / compensated，其余取值由使用方自行着色。 */
export type FlowNodeStatus = string

export interface FlowSceneOptions {
  /** 没有折点的连线交给它求折线。 */
  readonly route: FlowEdgeRouter
  /** 节点 id → 运行状态。 */
  readonly statuses?: Readonly<Record<string, FlowNodeStatus | null | undefined>>
  /** 高亮的节点 id。 */
  readonly highlighted?: Iterable<string>
  /** 箭头长度，缺省 8。 */
  readonly arrowSize?: number
  /** 折线拐角的圆角半径，缺省 6。 */
  readonly cornerRadius?: number
}

export interface FlowSceneNode {
  readonly id: string
  readonly node: FlowNode
  readonly nodeType: FlowNodeType | undefined
  readonly rect: FlowRect
  readonly label: string
  readonly status: FlowNodeStatus | undefined
  readonly highlighted: boolean
}

export interface FlowSceneEdge {
  readonly id: string
  readonly edge: FlowEdge
  /** 两端都解析到了端口。 */
  readonly anchored: boolean
  /** 完整折线（含两端）。 */
  readonly points: readonly FlowPoint[]
  /** SVG path 的 d，终点处让出箭头长度；未解析时为空串。 */
  readonly path: string
  /** 终点箭头三角形的 SVG path；未解析时为空串。 */
  readonly arrow: string
  readonly label: string | undefined
  /** 标签位置：折线总长一半处。 */
  readonly labelPoint: FlowPoint | undefined
  readonly dashed: boolean
}

export interface FlowScene {
  readonly nodes: readonly FlowSceneNode[]
  readonly edges: readonly FlowSceneEdge[]
  /** 包住节点、折线与标签位置的矩形；空文档为 undefined。 */
  readonly bounds: FlowRect | undefined
}

/** 算出整张图的场景。节点标签取 node.label，缺省取节点类型的 label，再缺省取 id。 */
export function buildScene(document: FlowDocument, registry: FlowNodeTypeRegistry, options: FlowSceneOptions): FlowScene {
  const arrowSize = options.arrowSize ?? 8
  const cornerRadius = options.cornerRadius ?? 6
  const highlighted = new Set(options.highlighted ?? [])
  const nodes: FlowSceneNode[] = document.nodes.map((node) => {
    const nodeType = registry.get(node.type)
    return {
      id: node.id,
      node,
      nodeType,
      rect: { x: node.x, y: node.y, width: node.width, height: node.height },
      label: node.label ?? nodeType?.label ?? node.id,
      status: options.statuses?.[node.id] ?? undefined,
      highlighted: highlighted.has(node.id),
    }
  })
  const geometry = computeEdgeGeometry(document, registry, options.route)
  const edges: FlowSceneEdge[] = document.edges.map((edge, index) => {
    const { anchored, points } = geometry[index]!
    const drawable = anchored && points.length >= 2
    return {
      id: edge.id,
      edge,
      anchored,
      points,
      path: drawable ? polylinePath(trimEnd(points, arrowSize), cornerRadius) : '',
      arrow: drawable ? arrowPath(points, arrowSize) : '',
      label: edge.label || undefined,
      labelPoint: drawable ? polylineMidpoint(points) : undefined,
      dashed: edge.style?.dashed === true,
    }
  })
  return { nodes, edges, bounds: sceneBounds(nodes, edges) }
}

/** 把折线写成 SVG path：拐角处倒圆弧，切点不越过相邻两段各自的中点。 */
export function polylinePath(points: readonly FlowPoint[], radius = 0): string {
  if (points.length === 0)
    return ''
  const path = createSvgPath()
  path.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i++) {
    const current = points[i]!
    const next = points[i + 1]
    if (next && radius > 0)
      path.arcTo(current.x, current.y, next.x, next.y, cornerRadius(points[i - 1]!, current, next, radius))
    else
      path.lineTo(current.x, current.y)
  }
  return path.toString()
}

/** 终点箭头：尖端在折线终点，沿最后一段方向，长 size、宽 size。 */
export function arrowPath(points: readonly FlowPoint[], size: number): string {
  const tip = points[points.length - 1]
  const from = lastDistinct(points)
  if (!tip || !from || size <= 0)
    return ''
  const length = Math.hypot(tip.x - from.x, tip.y - from.y)
  const ux = (tip.x - from.x) / length
  const uy = (tip.y - from.y) / length
  const baseX = tip.x - ux * size
  const baseY = tip.y - uy * size
  const half = size / 2
  const path = createSvgPath()
  path.moveTo(tip.x, tip.y)
  path.lineTo(baseX - uy * half, baseY + ux * half)
  path.lineTo(baseX + uy * half, baseY - ux * half)
  path.closePath()
  return path.toString()
}

/** 圆角半径：切点到拐点的距离不超过相邻两段各自长度的一半。 */
function cornerRadius(previous: FlowPoint, corner: FlowPoint, next: FlowPoint, radius: number): number {
  const inX = previous.x - corner.x
  const inY = previous.y - corner.y
  const outX = next.x - corner.x
  const outY = next.y - corner.y
  const inLength = Math.hypot(inX, inY)
  const outLength = Math.hypot(outX, outY)
  if (inLength === 0 || outLength === 0)
    return 0
  const cos = Math.max(-1, Math.min(1, (inX * outX + inY * outY) / (inLength * outLength)))
  const halfAngle = Math.acos(cos) / 2
  const reach = Math.min(inLength, outLength) / 2
  return Math.min(radius, reach * Math.tan(halfAngle))
}

/** 把折线终点沿最后一段往回收 amount，供箭头占位；最后一段不够长时收到它的起点为止。 */
function trimEnd(points: readonly FlowPoint[], amount: number): FlowPoint[] {
  const tip = points[points.length - 1]!
  const from = lastDistinct(points)
  if (!from || amount <= 0)
    return [...points]
  const length = Math.hypot(tip.x - from.x, tip.y - from.y)
  const keep = Math.max(0, length - amount) / length
  return [...points.slice(0, -1), { x: from.x + (tip.x - from.x) * keep, y: from.y + (tip.y - from.y) * keep }]
}

/** 终点之前最后一个与终点不重合的点。 */
function lastDistinct(points: readonly FlowPoint[]): FlowPoint | undefined {
  const tip = points[points.length - 1]
  if (!tip)
    return undefined
  for (let i = points.length - 2; i >= 0; i--) {
    const point = points[i]!
    if (point.x !== tip.x || point.y !== tip.y)
      return point
  }
  return undefined
}

/** 包住全部节点框与连线折线上各点的矩形。 */
function sceneBounds(nodes: readonly FlowSceneNode[], edges: readonly FlowSceneEdge[]): FlowRect | undefined {
  const points = edges.flatMap(edge => edge.points.map(point => ({ x: point.x, y: point.y, width: 0, height: 0 })))
  const vertices = edges.flatMap(edge => (edge.edge.vertices ?? []).map(point => ({ x: point.x, y: point.y, width: 0, height: 0 })))
  return unionRects([...nodes.map(node => node.rect), ...points, ...vertices])
}
