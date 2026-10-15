/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 查看器的场景：把文档、节点类型与运行状态算成可直接绘制的节点框、连线路径、箭头与标签位置，不碰 DOM。

import type { FlowDocument, FlowEdge, FlowEdgeRouter, FlowNode, FlowNodeType, FlowNodeTypeRegistry, FlowPoint, FlowRect } from '@xihan-flow/core'
import { computeEdgeGeometry } from '@xihan-flow/core'
import { unionRects } from '@xihan-ui/designer-kit'
import { arrowHeadPath, polylinePointAt, roundedPolylinePath, shortenPolyline } from '@xihan-ui/viz'

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
    const line = drawable ? shortenPolyline(points, { end: arrowSize }) : []
    return {
      id: edge.id,
      edge,
      anchored,
      points,
      path: drawable ? roundedPolylinePath(line, cornerRadius) : '',
      arrow: drawable ? arrowHeadPath(line[line.length - 1]!, points[points.length - 1]!, { length: arrowSize }) : '',
      label: edge.label || undefined,
      labelPoint: drawable ? polylinePointAt(points, 0.5) : undefined,
      dashed: edge.style?.dashed === true,
    }
  })
  return { nodes, edges, bounds: sceneBounds(nodes, edges) }
}

/** 包住全部节点框与连线折线上各点的矩形。 */
function sceneBounds(nodes: readonly FlowSceneNode[], edges: readonly FlowSceneEdge[]): FlowRect | undefined {
  const points = edges.flatMap(edge => edge.points.map(point => ({ x: point.x, y: point.y, width: 0, height: 0 })))
  const vertices = edges.flatMap(edge => (edge.edge.vertices ?? []).map(point => ({ x: point.x, y: point.y, width: 0, height: 0 })))
  return unionRects([...nodes.map(node => node.rect), ...points, ...vertices])
}
