/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '@xihan-ui/core/json'

/** 当前文档 schema 版本。 */
export const FLOW_DOCUMENT_VERSION = 1

/** 世界坐标系中的点。 */
export interface FlowPoint {
  /** 横坐标，向右为正。 */
  readonly x: number
  /** 纵坐标，向下为正。 */
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
  /** 节点 id，在文档内唯一，连线经它指向节点。 */
  readonly id: string
  /** 节点类型，对应登记表中的类型名。 */
  readonly type: string
  /** 节点上显示的文字。 */
  readonly label?: string
  /** 业务数据，有哪些字段由节点类型的属性描述决定。 */
  readonly data?: JsonObject
  /** 各扩展自己的数据，键是扩展 id，每一块是 JSON 对象；与业务数据 data 分开。 */
  readonly extensions?: JsonObject
}

/** 连线端点：节点与可选端口。 */
export interface FlowEndpoint {
  /** 节点 id。 */
  readonly node: string
  /** 端口 id；不写时取节点类型里第一个允许这一端的端口。 */
  readonly port?: string
}

/** 连线外观。 */
export interface FlowEdgeStyle {
  /** 画成虚线。 */
  readonly dashed?: boolean
}

/** 连线：起止端点、标签、外观、业务数据与可选折点。 */
export interface FlowEdge {
  /** 连线 id，在文档内唯一。 */
  readonly id: string
  /** 起点。 */
  readonly source: FlowEndpoint
  /** 终点。 */
  readonly target: FlowEndpoint
  /** 连线上显示的文字。 */
  readonly label?: string
  /** 外观。 */
  readonly style?: FlowEdgeStyle
  /** 业务数据，有哪些字段由连线属性描述决定。 */
  readonly data?: JsonObject
  /** 途经折点，按从起点到终点的顺序排列。 */
  readonly vertices?: readonly FlowPoint[]
  /** 各扩展自己的数据，键是扩展 id。 */
  readonly extensions?: JsonObject
}

/** 流程图文档；数组顺序即绘制层级，靠后的在上层。 */
export interface FlowDocument {
  /** 版本号，读入时与 FLOW_DOCUMENT_VERSION 比对。 */
  readonly version: typeof FLOW_DOCUMENT_VERSION
  /** 节点。 */
  readonly nodes: readonly FlowNode[]
  /** 连线。 */
  readonly edges: readonly FlowEdge[]
  /** 文档级业务数据。 */
  readonly data?: JsonObject
  /** 各扩展自己的数据，键是扩展 id。 */
  readonly extensions?: JsonObject
}

/** 创建空文档。 */
export function createDocument(data?: JsonObject): FlowDocument {
  return data === undefined
    ? { version: FLOW_DOCUMENT_VERSION, nodes: [], edges: [] }
    : { version: FLOW_DOCUMENT_VERSION, nodes: [], edges: [], data }
}
