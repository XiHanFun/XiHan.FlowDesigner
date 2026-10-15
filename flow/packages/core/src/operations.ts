/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject, JsonValue } from '@xihan-ui/core/json'
import type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowEndpoint, FlowNode, FlowPoint } from './schema'
import { jsonEquals } from '@xihan-ui/core/json'
import { applyInSequence } from '@xihan-ui/designer-kit'

/** 节点的新位置。 */
export interface FlowNodePosition {
  readonly id: string
  readonly x: number
  readonly y: number
}

/** 节点字段补丁：缺省表示不变，null 表示删除该字段。 */
export interface FlowNodePatch {
  readonly label?: string | null
  readonly data?: JsonObject | null
}

/** 连线字段补丁：缺省表示不变，null 表示删除该字段。 */
export interface FlowEdgePatch {
  readonly label?: string | null
  readonly style?: FlowEdgeStyle | null
  readonly data?: JsonObject | null
  readonly vertices?: readonly FlowPoint[] | null
}

/** 文档字段补丁：缺省表示不变，null 表示删除该字段。 */
export interface FlowDocumentPatch {
  readonly data?: JsonObject | null
}

/** 编辑操作；所有操作都是纯 JSON。 */
export type FlowOperation
  = | { readonly type: 'addNode', readonly node: FlowNode, readonly index?: number }
    | { readonly type: 'removeNode', readonly id: string }
    | { readonly type: 'moveNodes', readonly positions: readonly FlowNodePosition[] }
    | { readonly type: 'resizeNode', readonly id: string, readonly x: number, readonly y: number, readonly width: number, readonly height: number }
    | { readonly type: 'updateNode', readonly id: string, readonly patch: FlowNodePatch }
    | { readonly type: 'addEdge', readonly edge: FlowEdge, readonly index?: number }
    | { readonly type: 'removeEdge', readonly id: string }
    | { readonly type: 'reconnectEdge', readonly id: string, readonly source?: FlowEndpoint, readonly target?: FlowEndpoint }
    | { readonly type: 'updateEdge', readonly id: string, readonly patch: FlowEdgePatch }
    | { readonly type: 'updateDocument', readonly patch: FlowDocumentPatch }

/** 操作类型名。 */
export type FlowOperationType = FlowOperation['type']

/** 应用操作的结果：新文档与按顺序应用即可撤销的逆操作；没有带来变化时文档是传入的同一引用、逆操作为空。 */
export interface FlowOperationResult {
  readonly document: FlowDocument
  readonly inverse: readonly FlowOperation[]
}

/** 操作失败原因。 */
export type FlowOperationErrorCode
  = | 'node-not-found'
    | 'edge-not-found'
    | 'duplicate-id'
    | 'invalid-operation'

/** 操作无法应用时抛出的错误；文档保持不变。 */
export class FlowOperationError extends Error {
  readonly code: FlowOperationErrorCode
  readonly operation: FlowOperation

  constructor(code: FlowOperationErrorCode, operation: FlowOperation, message: string) {
    super(`[flow-core] ${operation.type}: ${message}`)
    this.name = 'FlowOperationError'
    this.code = code
    this.operation = operation
  }
}

type Op<T extends FlowOperationType> = Extract<FlowOperation, { type: T }>

const NODE_PATCH_KEYS: readonly string[] = ['label', 'data']
const EDGE_PATCH_KEYS: readonly string[] = ['label', 'style', 'data', 'vertices']
const DOCUMENT_PATCH_KEYS: readonly string[] = ['data']

/**
 * 应用一个编辑操作，返回新文档与逆操作，不修改输入文档；未改动的节点与连线沿用原引用。
 * 操作没有带来变化时返回传入文档的同一引用，逆操作为空数组。
 * 操作只保证 id 唯一与被操作对象存在，引用完整性与端口约束由 validateDocument 与 checkConnection 负责。
 * 删除节点时级联删除与它相连的连线，逆操作会把它们放回原位置。
 */
export function applyOperation(document: FlowDocument, operation: FlowOperation): FlowOperationResult {
  switch (operation.type) {
    case 'addNode':
      return addNode(document, operation)
    case 'removeNode':
      return removeNode(document, operation)
    case 'moveNodes':
      return moveNodes(document, operation)
    case 'resizeNode':
      return resizeNode(document, operation)
    case 'updateNode':
      return updateNode(document, operation)
    case 'addEdge':
      return addEdge(document, operation)
    case 'removeEdge':
      return removeEdge(document, operation)
    case 'reconnectEdge':
      return reconnectEdge(document, operation)
    case 'updateEdge':
      return updateEdge(document, operation)
    case 'updateDocument':
      return updateDocument(document, operation)
    default:
      throw new FlowOperationError('invalid-operation', operation, `unknown operation type "${String((operation as { type: unknown }).type)}"`)
  }
}

/**
 * 依次应用一组操作；逆操作为各操作逆操作按反序拼接。任一操作失败时抛错，输入文档保持不变。
 */
export function applyOperations(document: FlowDocument, operations: readonly FlowOperation[]): FlowOperationResult {
  return applyInSequence(applyOperation, document, operations)
}

function addNode(document: FlowDocument, operation: Op<'addNode'>): FlowOperationResult {
  const { node } = operation
  if (document.nodes.some(item => item.id === node.id))
    throw new FlowOperationError('duplicate-id', operation, `node "${node.id}" already exists`)
  const index = insertionIndex(operation, operation.index, document.nodes.length)
  const referencing = edgesTouching(document, node.id)
  return {
    document: { ...document, nodes: insertAt(document.nodes, index, node) },
    inverse: [
      { type: 'removeNode', id: node.id },
      ...referencing.map(({ edge, index: edgeIndex }): FlowOperation => ({ type: 'addEdge', edge, index: edgeIndex })),
    ],
  }
}

function removeNode(document: FlowDocument, operation: Op<'removeNode'>): FlowOperationResult {
  const index = nodeIndexOf(document, operation, operation.id)
  const node = document.nodes[index]!
  const removed = edgesTouching(document, node.id)
  const removedEdges = new Set(removed.map(item => item.edge))
  return {
    document: {
      ...document,
      nodes: removeAt(document.nodes, index),
      edges: removed.length === 0 ? document.edges : document.edges.filter(edge => !removedEdges.has(edge)),
    },
    inverse: [
      { type: 'addNode', node, index },
      ...removed.map(({ edge, index: edgeIndex }): FlowOperation => ({ type: 'addEdge', edge, index: edgeIndex })),
    ],
  }
}

function moveNodes(document: FlowDocument, operation: Op<'moveNodes'>): FlowOperationResult {
  const targets = new Map<string, FlowNodePosition>()
  for (const position of operation.positions) {
    if (targets.has(position.id))
      throw new FlowOperationError('invalid-operation', operation, `node "${position.id}" is listed more than once`)
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
      throw new FlowOperationError('invalid-operation', operation, `position of node "${position.id}" must be finite`)
    targets.set(position.id, position)
  }
  const previous = new Map<string, FlowNodePosition>()
  const seen = new Set<string>()
  const nodes = document.nodes.map((node) => {
    const target = targets.get(node.id)
    if (!target || seen.has(node.id))
      return node
    seen.add(node.id)
    if (target.x === node.x && target.y === node.y)
      return node
    previous.set(node.id, { id: node.id, x: node.x, y: node.y })
    return { ...node, x: target.x, y: target.y }
  })
  for (const id of targets.keys()) {
    if (!seen.has(id))
      throw new FlowOperationError('node-not-found', operation, `node "${id}" does not exist`)
  }
  if (previous.size === 0)
    return unchanged(document)
  return {
    document: { ...document, nodes },
    inverse: [{ type: 'moveNodes', positions: operation.positions.flatMap(position => previous.get(position.id) ?? []) }],
  }
}

function resizeNode(document: FlowDocument, operation: Op<'resizeNode'>): FlowOperationResult {
  const { x, y, width, height } = operation
  if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0)
    throw new FlowOperationError('invalid-operation', operation, 'bounds must be finite with non-negative size')
  const index = nodeIndexOf(document, operation, operation.id)
  const node = document.nodes[index]!
  if (node.x === x && node.y === y && node.width === width && node.height === height)
    return unchanged(document)
  return {
    document: { ...document, nodes: replaceAt(document.nodes, index, { ...node, x, y, width, height }) },
    inverse: [{ type: 'resizeNode', id: node.id, x: node.x, y: node.y, width: node.width, height: node.height }],
  }
}

function updateNode(document: FlowDocument, operation: Op<'updateNode'>): FlowOperationResult {
  const index = nodeIndexOf(document, operation, operation.id)
  const node = document.nodes[index]!
  const { value, inverse } = applyPatch(operation, node, operation.patch, NODE_PATCH_KEYS)
  if (value === node)
    return unchanged(document)
  return {
    document: { ...document, nodes: replaceAt(document.nodes, index, value) },
    inverse: [{ type: 'updateNode', id: node.id, patch: inverse }],
  }
}

function addEdge(document: FlowDocument, operation: Op<'addEdge'>): FlowOperationResult {
  const { edge } = operation
  if (document.edges.some(item => item.id === edge.id))
    throw new FlowOperationError('duplicate-id', operation, `edge "${edge.id}" already exists`)
  const index = insertionIndex(operation, operation.index, document.edges.length)
  return {
    document: { ...document, edges: insertAt(document.edges, index, edge) },
    inverse: [{ type: 'removeEdge', id: edge.id }],
  }
}

function removeEdge(document: FlowDocument, operation: Op<'removeEdge'>): FlowOperationResult {
  const index = edgeIndexOf(document, operation, operation.id)
  const edge = document.edges[index]!
  return {
    document: { ...document, edges: removeAt(document.edges, index) },
    inverse: [{ type: 'addEdge', edge, index }],
  }
}

function reconnectEdge(document: FlowDocument, operation: Op<'reconnectEdge'>): FlowOperationResult {
  const { source, target } = operation
  if (source === undefined && target === undefined)
    throw new FlowOperationError('invalid-operation', operation, 'source or target is required')
  const index = edgeIndexOf(document, operation, operation.id)
  const edge = document.edges[index]!
  const moveSource = source !== undefined && !sameValue(source, edge.source)
  const moveTarget = target !== undefined && !sameValue(target, edge.target)
  if (!moveSource && !moveTarget)
    return unchanged(document)
  return {
    document: {
      ...document,
      edges: replaceAt(document.edges, index, {
        ...edge,
        source: moveSource ? source : edge.source,
        target: moveTarget ? target : edge.target,
      }),
    },
    inverse: [{
      type: 'reconnectEdge',
      id: edge.id,
      ...(moveSource ? { source: edge.source } : {}),
      ...(moveTarget ? { target: edge.target } : {}),
    }],
  }
}

function updateEdge(document: FlowDocument, operation: Op<'updateEdge'>): FlowOperationResult {
  const index = edgeIndexOf(document, operation, operation.id)
  const edge = document.edges[index]!
  const { value, inverse } = applyPatch(operation, edge, operation.patch, EDGE_PATCH_KEYS)
  if (value === edge)
    return unchanged(document)
  return {
    document: { ...document, edges: replaceAt(document.edges, index, value) },
    inverse: [{ type: 'updateEdge', id: edge.id, patch: inverse }],
  }
}

function updateDocument(document: FlowDocument, operation: Op<'updateDocument'>): FlowOperationResult {
  const { value, inverse } = applyPatch(operation, document, operation.patch, DOCUMENT_PATCH_KEYS)
  if (value === document)
    return unchanged(document)
  return {
    document: value,
    inverse: [{ type: 'updateDocument', patch: inverse }],
  }
}

/**
 * 按补丁写入字段：缺省不变，null 删除；同时给出恢复原值的补丁，只含真正变了的字段。
 * 没有字段变化时返回传入的同一对象。补丁含未登记字段时抛错。
 */
function applyPatch<T extends object, P extends object>(
  operation: FlowOperation,
  target: T,
  patch: P,
  allowed: readonly string[],
): { value: T, inverse: P } {
  const source = target as Record<string, unknown>
  const value: Record<string, unknown> = { ...source }
  const inverse: Record<string, unknown> = {}
  let changed = false
  for (const [key, next] of Object.entries(patch)) {
    if (!allowed.includes(key))
      throw new FlowOperationError('invalid-operation', operation, `field "${key}" cannot be patched`)
    if (next === undefined)
      continue
    const current = source[key]
    if (next === null ? current === undefined : sameValue(current, next))
      continue
    changed = true
    inverse[key] = current === undefined ? null : current
    if (next === null)
      delete value[key]
    else
      value[key] = next
  }
  return changed ? { value: value as T, inverse: inverse as P } : { value: target, inverse: {} as P }
}

/** 没有带来变化的结果：同一文档、空逆操作。 */
function unchanged(document: FlowDocument): FlowOperationResult {
  return { document, inverse: [] }
}

/** 按 JSON 值比较两个字段值。 */
function sameValue(a: unknown, b: unknown): boolean {
  return jsonEquals(a as JsonValue | undefined, b as JsonValue | undefined)
}

function edgesTouching(document: FlowDocument, nodeId: string): { edge: FlowEdge, index: number }[] {
  const result: { edge: FlowEdge, index: number }[] = []
  document.edges.forEach((edge, index) => {
    if (edge.source.node === nodeId || edge.target.node === nodeId)
      result.push({ edge, index })
  })
  return result
}

function nodeIndexOf(document: FlowDocument, operation: FlowOperation, id: string): number {
  const index = document.nodes.findIndex(node => node.id === id)
  if (index < 0)
    throw new FlowOperationError('node-not-found', operation, `node "${id}" does not exist`)
  return index
}

function edgeIndexOf(document: FlowDocument, operation: FlowOperation, id: string): number {
  const index = document.edges.findIndex(edge => edge.id === id)
  if (index < 0)
    throw new FlowOperationError('edge-not-found', operation, `edge "${id}" does not exist`)
  return index
}

function insertionIndex(operation: FlowOperation, index: number | undefined, length: number): number {
  if (index === undefined)
    return length
  if (!Number.isInteger(index) || index < 0 || index > length)
    throw new FlowOperationError('invalid-operation', operation, `index ${index} is out of range [0, ${length}]`)
  return index
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)]
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)]
}

function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  const copy = [...items]
  copy[index] = item
  return copy
}
