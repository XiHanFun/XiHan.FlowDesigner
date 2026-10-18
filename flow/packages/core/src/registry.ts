/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { IconRecord } from '@xihan-ui/core'
import type { JsonObject } from '@xihan-ui/core/json'
import type { PropertyCondition, PropertyControl, PropertyDescriptor } from '@xihan-ui/designer-kit/properties'
import type { FlowEdgeEnd } from './issues'
import type { FlowEdge, FlowEdgeStyle, FlowNode, FlowPoint, FlowRect, FlowSize } from './schema'
import { cloneJson, findJsonViolation, formatJsonPath, getJsonAt } from '@xihan-ui/core/json'
import { applyDefaults, evaluateCondition } from '@xihan-ui/designer-kit/properties'

/** 端口方向：只入、只出或双向。 */
export type FlowPortDirection = 'in' | 'out' | 'both'

/** 端口所在的节点边。 */
export type FlowPortSide = 'top' | 'right' | 'bottom' | 'left'

/** 端口预设：in 为左侧入口 in，out 为右侧出口 out，both 为两者都有，none 为无端口。 */
export type FlowPortPreset = 'in' | 'out' | 'both' | 'none'

/** 具名端口定义。 */
export interface FlowPortDefinition {
  /** 端口 id，连线端点的 port 写它；同一节点类型里不能重复。 */
  readonly id: string
  /** 方向：in 只能连入，out 只能连出，both 两样都行。 */
  readonly direction: FlowPortDirection
  /** 端口在节点的哪条边上。 */
  readonly side: FlowPortSide
  /** 沿所在边从左到右或从上到下的相对位置，取值 0 到 1，缺省 0.5。 */
  readonly offset?: number
  /** 端口的显示名：设计器把它写在端口外侧，随端口一起显出；内核不解释。 */
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

/** 节点属性的编辑方式：内建的编辑方式之外，扩展可以登记自己的种类（如受理人选择），编辑器由设计器层的扩展提供。 */
export type FlowPropertyControl = PropertyControl | { readonly kind: string }

/** 节点属性描述：path 相对节点本身，如 ['data', 'properties', 'Url']、['label']。 */
export type FlowPropertyDescriptor = PropertyDescriptor<FlowPropertyControl>

/** 按连线数据给的外观：when 对连线本身求值，满足时并上 style。 */
export interface FlowEdgeStyleRule {
  /** 条件，路径相对连线本身，如 ['data', 'isDefault']；写法同属性描述的 visibleWhen。 */
  readonly when: PropertyCondition
  /** 满足条件时的外观。 */
  readonly style: FlowEdgeStyle
}

/** 新建节点时的默认值。 */
export interface FlowNodeDefaults {
  /** 新节点的标签。 */
  readonly label?: string
  /** 新节点的 data，每次新建时深拷贝一份。 */
  readonly data?: JsonObject
}

/** 节点类型定义：同时驱动物料面板、属性面板、连线约束与结构校验。 */
export interface FlowNodeTypeDefinition {
  /** 类型名，节点的 type 写它。 */
  readonly type: string
  /** 显示名：物料面板、属性面板的标题与问题说明里用它，不给时显示 type；节点自己没写标签时画布上也显示它。 */
  readonly label?: string
  /** 物料面板里的类别，按它分组。 */
  readonly category?: string
  /** 图标：内置的节点渲染画在文字前面，物料面板的条目也显示它；自定义的节点渲染可以从节点类型上读它。 */
  readonly icon?: IconRecord
  /** 常用：给了就在设计器的顶栏放一颗插入这种节点的快捷钮（图标在上、显示名在下），按这个数从小到大排。 */
  readonly quickInsert?: number
  /** 新建节点的尺寸。 */
  readonly size: FlowSize
  /** 端口：预设，或具名端口的列表。 */
  readonly ports: FlowPortPreset | readonly FlowPortDefinition[]
  /** 新建节点时写入的标签与 data。 */
  readonly defaults?: FlowNodeDefaults
  /** 连接约束：入出线条数与能连的节点类型。 */
  readonly connection?: FlowConnectionRule
  /** 作为可达性分析的起点，且不要求有入线。 */
  readonly entry?: boolean
  /** 不要求有出线。 */
  readonly terminal?: boolean
  /** 文档中该类型节点的最少个数。 */
  readonly minCount?: number
  /** 文档中该类型节点的最多个数。 */
  readonly maxCount?: number
  /** 属性面板里的属性，path 相对节点本身；校验按它们检查取值。 */
  readonly properties?: readonly FlowPropertyDescriptor[]
  /** 从这类节点连出的连线多出的属性，path 相对连线本身，如决策节点出线的条件与是否默认分支。 */
  readonly outgoingEdges?: readonly FlowPropertyDescriptor[]
  /**
   * 从这类节点连出的连线按数据给的外观，如条件分支的默认分支画成虚线：按先后逐条看，满足的依次并上。
   * 连线自己写的 style 逐项压过它们；推出的外观只用于绘制，不写回流程定义。
   */
  readonly outgoingEdgeStyles?: readonly FlowEdgeStyleRule[]
  /** 扩展自用的数据；内核不解释。 */
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

/**
 * 按节点类型新建节点：尺寸、标签与 data 取类型默认值，init 中给出的字段优先；
 * 再把属性描述的缺省值写进还没有值的路径。
 */
export function createNode(nodeType: FlowNodeType, init: FlowNodeInit): FlowNode {
  const label = init.label ?? nodeType.defaults?.label
  const data = init.data ?? (nodeType.defaults?.data === undefined ? undefined : cloneJson(nodeType.defaults.data))
  const node: FlowNode = {
    id: init.id,
    type: nodeType.type,
    x: init.x,
    y: init.y,
    width: init.width ?? nodeType.size.width,
    height: init.height ?? nodeType.size.height,
    ...(label === undefined ? {} : { label }),
    ...(data === undefined ? {} : { data }),
  }
  return applyDefaults(node as unknown as JsonObject, nodeType.properties ?? []) as unknown as FlowNode
}

/** 查找节点类型上的端口。 */
export function findPort(nodeType: FlowNodeType, portId: string): FlowPort | undefined {
  return nodeType.ports.find(port => port.id === portId)
}

/**
 * 连线此刻的外观：源节点类型的 outgoingEdgeStyles 按先后并上满足条件的，连线自己写的 style 再逐项压过；
 * 源节点类型未知时只有连线自己写的。
 */
export function resolveEdgeStyle(edge: FlowEdge, sourceType: FlowNodeType | undefined): FlowEdgeStyle {
  let style: FlowEdgeStyle = {}
  for (const rule of sourceType?.outgoingEdgeStyles ?? []) {
    if (evaluateCondition(rule.when, edge as unknown as JsonObject))
      style = { ...style, ...rule.style }
  }
  return edge.style ? { ...style, ...edge.style } : style
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
  if (definition.quickInsert !== undefined && !Number.isFinite(definition.quickInsert))
    fail(type, 'quickInsert must be a finite number')
  for (const rule of definition.outgoingEdgeStyles ?? [])
    checkJson(type, 'outgoingEdgeStyles', rule as unknown as JsonObject)

  const ports = typeof definition.ports === 'string'
    ? presetPorts(type, definition.ports)
    : definition.ports.map(port => normalizePort(type, port))
  const portIds = new Set<string>()
  for (const port of ports) {
    if (portIds.has(port.id))
      fail(type, `port "${port.id}" is declared more than once`)
    portIds.add(port.id)
  }

  checkPaths(type, 'property', definition.properties)
  checkPaths(type, 'outgoing edge property', definition.outgoingEdges)

  return { ...definition, ports }
}

function checkPaths(type: string, name: string, descriptors: readonly FlowPropertyDescriptor[] | undefined): void {
  const paths = new Set<string>()
  for (const descriptor of descriptors ?? []) {
    if (descriptor.path.length === 0)
      fail(type, `${name} path must not be empty`)
    try {
      getJsonAt(undefined, descriptor.path)
    }
    catch {
      fail(type, `${name} path ${JSON.stringify(descriptor.path)} is invalid`)
    }
    const key = formatJsonPath(descriptor.path)
    if (paths.has(key))
      fail(type, `${name} ${key} is declared more than once`)
    paths.add(key)
  }
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
