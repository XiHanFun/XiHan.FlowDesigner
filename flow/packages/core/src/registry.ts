/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowEdgeEnd } from './issues'
import type { JsonObject } from './json'
import type { FlowPropertyDescriptor } from './properties'
import type { FlowNode, FlowPoint, FlowRect, FlowSize } from './schema'
import { cloneJson, findJsonViolation } from './json'

/** 端口方向：只入、只出或双向。 */
export type FlowPortDirection = 'in' | 'out' | 'both'

/** 端口所在的节点边。 */
export type FlowPortSide = 'top' | 'right' | 'bottom' | 'left'

/** 端口预设：in 为左侧入口 in，out 为右侧出口 out，both 为两者都有，none 为无端口。 */
export type FlowPortPreset = 'in' | 'out' | 'both' | 'none'

/** 具名端口定义。 */
export interface FlowPortDefinition {
  readonly id: string
  readonly direction: FlowPortDirection
  readonly side: FlowPortSide
  /** 沿所在边从左到右或从上到下的相对位置，取值 0 到 1，缺省 0.5。 */
  readonly offset?: number
  readonly label?: string
  /** 该端口最多连接的连线数。 */
  readonly maxConnections?: number
}

/** 规范化后的端口。 */
export interface FlowPort extends FlowPortDefinition {
  readonly offset: number
}

/** 连接约束。 */
export interface FlowConnectionRule {
  /** 最大入度。 */
  readonly maxIncoming?: number
  /** 最大出度。 */
  readonly maxOutgoing?: number
  /** 允许连向的节点类型；缺省时不限。 */
  readonly allowedTargets?: readonly string[]
  /** 允许连入的来源节点类型；缺省时不限。 */
  readonly allowedSources?: readonly string[]
  /** 是否允许连向自身，缺省不允许。 */
  readonly allowSelfLoop?: boolean
}

/** 新建节点时的默认值。 */
export interface FlowNodeDefaults {
  readonly label?: string
  readonly data?: JsonObject
}

/** 节点类型定义：同时驱动物料面板、属性面板、连线约束与结构校验。 */
export interface FlowNodeTypeDefinition {
  readonly type: string
  readonly label?: string
  readonly category?: string
  readonly icon?: string
  /** 新建节点的尺寸。 */
  readonly size: FlowSize
  readonly ports: FlowPortPreset | readonly FlowPortDefinition[]
  readonly defaults?: FlowNodeDefaults
  readonly connection?: FlowConnectionRule
  /** 作为可达性分析的起点，且不要求有入线。 */
  readonly entry?: boolean
  /** 不要求有出线。 */
  readonly terminal?: boolean
  /** 文档中该类型节点的最少个数。 */
  readonly minCount?: number
  /** 文档中该类型节点的最多个数。 */
  readonly maxCount?: number
  readonly properties?: readonly FlowPropertyDescriptor[]
  readonly meta?: JsonObject
}

/** 规范化后的节点类型：端口展开为具名端口列表。 */
export interface FlowNodeType extends Omit<FlowNodeTypeDefinition, 'ports'> {
  readonly ports: readonly FlowPort[]
}

/** 节点类型登记表。 */
export interface FlowNodeTypeRegistry {
  /** 按登记顺序排列的全部类型。 */
  readonly types: readonly FlowNodeType[]
  get: (type: string) => FlowNodeType | undefined
}

/** 新建节点的参数。 */
export interface FlowNodeInit {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width?: number
  readonly height?: number
  readonly label?: string
  readonly data?: JsonObject
}

const PORT_PRESETS: Readonly<Record<FlowPortPreset, readonly FlowPort[]>> = {
  in: [{ id: 'in', direction: 'in', side: 'left', offset: 0.5 }],
  out: [{ id: 'out', direction: 'out', side: 'right', offset: 0.5 }],
  both: [
    { id: 'in', direction: 'in', side: 'left', offset: 0.5 },
    { id: 'out', direction: 'out', side: 'right', offset: 0.5 },
  ],
  none: [],
}

const PORT_DIRECTIONS: readonly string[] = ['in', 'out', 'both']
const PORT_SIDES: readonly string[] = ['top', 'right', 'bottom', 'left']

/** 创建节点类型登记表；定义不合法时抛错。 */
export function createNodeTypeRegistry(definitions: readonly FlowNodeTypeDefinition[]): FlowNodeTypeRegistry {
  const map = new Map<string, FlowNodeType>()
  for (const definition of definitions) {
    if (map.has(definition.type))
      fail(definition.type, 'is registered more than once')
    map.set(definition.type, normalizeNodeType(definition))
  }
  const types = [...map.values()]
  return {
    types,
    get: type => map.get(type),
  }
}

/** 按节点类型新建节点：尺寸、标签与 data 取类型默认值，init 中给出的字段优先。 */
export function createNode(nodeType: FlowNodeType, init: FlowNodeInit): FlowNode {
  const label = init.label ?? nodeType.defaults?.label
  const data = init.data ?? (nodeType.defaults?.data === undefined ? undefined : cloneJson(nodeType.defaults.data))
  return {
    id: init.id,
    type: nodeType.type,
    x: init.x,
    y: init.y,
    width: init.width ?? nodeType.size.width,
    height: init.height ?? nodeType.size.height,
    ...(label === undefined ? {} : { label }),
    ...(data === undefined ? {} : { data }),
  }
}

/** 查找节点类型上的端口。 */
export function findPort(nodeType: FlowNodeType, portId: string): FlowPort | undefined {
  return nodeType.ports.find(port => port.id === portId)
}

/** 判断端口能否作为连线的指定一端：起点需可出，终点需可入。 */
export function portAllows(port: FlowPort, end: FlowEdgeEnd): boolean {
  return port.direction === 'both' || port.direction === (end === 'source' ? 'out' : 'in')
}

/** 计算端口在世界坐标系中的位置。 */
export function getPortPosition(node: FlowRect, port: FlowPort): FlowPoint {
  switch (port.side) {
    case 'top':
      return { x: node.x + node.width * port.offset, y: node.y }
    case 'bottom':
      return { x: node.x + node.width * port.offset, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: node.y + node.height * port.offset }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height * port.offset }
  }
}

function normalizeNodeType(definition: FlowNodeTypeDefinition): FlowNodeType {
  const { type } = definition
  if (typeof type !== 'string' || type.length === 0)
    throw new Error('[flow-core] node type name must be a non-empty string')
  const { width, height } = definition.size
  if (!isNonNegative(width) || !isNonNegative(height))
    fail(type, 'size must be finite and non-negative')
  checkCount(type, 'minCount', definition.minCount)
  checkCount(type, 'maxCount', definition.maxCount)
  if (definition.minCount !== undefined && definition.maxCount !== undefined && definition.minCount > definition.maxCount)
    fail(type, 'minCount must not exceed maxCount')
  checkCount(type, 'connection.maxIncoming', definition.connection?.maxIncoming)
  checkCount(type, 'connection.maxOutgoing', definition.connection?.maxOutgoing)
  checkJson(type, 'defaults.data', definition.defaults?.data)
  checkJson(type, 'meta', definition.meta)

  const ports = typeof definition.ports === 'string'
    ? presetPorts(type, definition.ports)
    : definition.ports.map(port => normalizePort(type, port))
  const portIds = new Set<string>()
  for (const port of ports) {
    if (portIds.has(port.id))
      fail(type, `port "${port.id}" is declared more than once`)
    portIds.add(port.id)
  }

  const paths = new Set<string>()
  for (const descriptor of definition.properties ?? []) {
    if (descriptor.path.length === 0)
      fail(type, 'property path must not be empty')
    const key = JSON.stringify(descriptor.path)
    if (paths.has(key))
      fail(type, `property ${key} is declared more than once`)
    paths.add(key)
  }

  return { ...definition, ports }
}

function presetPorts(type: string, preset: FlowPortPreset): readonly FlowPort[] {
  const ports = PORT_PRESETS[preset]
  if (!ports)
    fail(type, `unknown port preset "${String(preset)}"`)
  return ports
}

function normalizePort(type: string, port: FlowPortDefinition): FlowPort {
  if (typeof port.id !== 'string' || port.id.length === 0)
    fail(type, 'port id must be a non-empty string')
  if (!PORT_DIRECTIONS.includes(port.direction))
    fail(type, `port "${port.id}" has unknown direction "${String(port.direction)}"`)
  if (!PORT_SIDES.includes(port.side))
    fail(type, `port "${port.id}" has unknown side "${String(port.side)}"`)
  const offset = port.offset ?? 0.5
  if (!Number.isFinite(offset) || offset < 0 || offset > 1)
    fail(type, `port "${port.id}" offset must be within [0, 1]`)
  checkCount(type, `port "${port.id}" maxConnections`, port.maxConnections)
  return { ...port, offset }
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function checkCount(type: string, name: string, value: number | undefined): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 0))
    fail(type, `${name} must be a non-negative integer`)
}

function checkJson(type: string, name: string, value: JsonObject | undefined): void {
  if (value !== undefined && findJsonViolation(value) !== undefined)
    fail(type, `${name} must be JSON`)
}

function fail(type: string, message: string): never {
  throw new Error(`[flow-core] node type "${type}" ${message}`)
}
