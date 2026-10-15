/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '@xihan-ui/core/json'

/** 当前文档 schema 版本。 */
export const FLOW_DOCUMENT_VERSION = 1

/** 世界坐标系中的点。 */
export interface FlowPoint {
  readonly x: number
  readonly y: number
}

/** 尺寸。 */
export interface FlowSize {
  readonly width: number
  readonly height: number
}

/** 轴对齐矩形。 */
export interface FlowRect extends FlowPoint, FlowSize {}

/** 节点：左上角坐标、尺寸、可选标签与业务数据。 */
export interface FlowNode extends FlowRect {
  readonly id: string
  /** 节点类型，对应登记表中的类型名。 */
  readonly type: string
  readonly label?: string
  readonly data?: JsonObject
}

/** 连线端点：节点与可选端口。 */
export interface FlowEndpoint {
  readonly node: string
  readonly port?: string
}

/** 连线外观。 */
export interface FlowEdgeStyle {
  readonly dashed?: boolean
}

/** 连线：起止端点、标签、外观、业务数据与可选折点。 */
export interface FlowEdge {
  readonly id: string
  readonly source: FlowEndpoint
  readonly target: FlowEndpoint
  readonly label?: string
  readonly style?: FlowEdgeStyle
  readonly data?: JsonObject
  /** 途经折点，按从起点到终点的顺序排列。 */
  readonly vertices?: readonly FlowPoint[]
}

/** 流程图文档；数组顺序即绘制层级，靠后的在上层。 */
export interface FlowDocument {
  readonly version: typeof FLOW_DOCUMENT_VERSION
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
  /** 文档级业务数据。 */
  readonly data?: JsonObject
}

/** 创建空文档。 */
export function createDocument(data?: JsonObject): FlowDocument {
  return data === undefined
    ? { version: FLOW_DOCUMENT_VERSION, nodes: [], edges: [] }
    : { version: FLOW_DOCUMENT_VERSION, nodes: [], edges: [], data }
}
