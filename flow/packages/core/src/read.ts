/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject, JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { IssueSink } from '@xihan-ui/designer-kit/schema'
import type { FlowIssue, FlowSchemaIssueCode } from './issues'
import type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowEndpoint, FlowNode, FlowPoint } from './schema'
import { cloneJson, isPlainObject } from '@xihan-ui/core/json'
import { createIssueSink, readArray, readBoolean, readJson, readNumber, readObject, readString } from '@xihan-ui/designer-kit/schema'
import { FLOW_DOCUMENT_VERSION } from './schema'

/** 读取结果：成功时给出规范化后的文档副本，失败时给出全部结构问题。 */
export type FlowReadResult
  = | { readonly ok: true, readonly document: FlowDocument }
    | { readonly ok: false, readonly issues: readonly FlowIssue<FlowSchemaIssueCode>[] }

type Sink = IssueSink<FlowSchemaIssueCode>

const DOCUMENT_KEYS = ['version', 'nodes', 'edges', 'data', 'extensions']
const NODE_KEYS = ['id', 'type', 'x', 'y', 'width', 'height', 'label', 'data', 'extensions']
const EDGE_KEYS = ['id', 'source', 'target', 'label', 'style', 'data', 'vertices', 'extensions']
const ENDPOINT_KEYS = ['node', 'port']
const STYLE_KEYS = ['dashed']
const POINT_KEYS = ['x', 'y']

/**
 * 把未知输入读成文档：逐项检查字段类型、必填项与多余字段，返回不与输入共享引用的副本。
 * 只检查结构；重复 id、悬空引用等语义问题由 validateDocument 负责。
 */
export function readDocument(value: unknown): FlowReadResult {
  const sink = createIssueSink<FlowSchemaIssueCode>()
  const fail = (): FlowReadResult => ({ ok: false, issues: sink.issues })
  if (!isPlainObject(value)) {
    sink.report('invalid-type', [], { params: { expected: 'object' } })
    return fail()
  }
  const fields = readObject(sink, value, [], { required: ['version', 'nodes', 'edges'], allowed: DOCUMENT_KEYS })!

  const version = fields.version
  if (version !== undefined && version !== FLOW_DOCUMENT_VERSION) {
    if (typeof version === 'number' && Number.isFinite(version)) {
      sink.report('document.unsupported-version', ['version'], { params: { version, supported: FLOW_DOCUMENT_VERSION } })
      return fail()
    }
    readNumber(sink, version, ['version'])
  }

  const nodes = readItems(sink, fields.nodes, ['nodes'], readNode)
  const edges = readItems(sink, fields.edges, ['edges'], readEdge)
  const data = readData(sink, fields.data, ['data'])
  const extensions = readExtensions(sink, fields.extensions, ['extensions'])

  if (sink.issues.length > 0 || !nodes || !edges)
    return fail()
  const document: FlowDocument = {
    version: FLOW_DOCUMENT_VERSION,
    nodes,
    edges,
    ...(data === undefined ? {} : { data }),
    ...(extensions === undefined ? {} : { extensions }),
  }
  return { ok: true, document }
}

/** 读取数组的每一项，任一项失败时返回 undefined。 */
function readItems<T>(sink: Sink, value: unknown, path: JsonPath, readItem: (sink: Sink, item: unknown, path: JsonPath) => T | undefined): T[] | undefined {
  const items = readArray(sink, value, path)
  if (!items)
    return undefined
  const result: T[] = []
  let failed = false
  items.forEach((item, index) => {
    const read = readItem(sink, item, [...path, index])
    if (read === undefined)
      failed = true
    else
      result.push(read)
  })
  return failed ? undefined : result
}

/** 读取扩展数据：键是扩展 id，每一块都必须是 JSON 对象，里面不看；深拷贝。 */
function readExtensions(sink: Sink, value: unknown, path: JsonPath): JsonObject | undefined {
  const fields = readObject(sink, value, path)
  if (!fields)
    return undefined
  const before = sink.issues.length
  for (const [id, data] of Object.entries(fields))
    readData(sink, data, [...path, id])
  return sink.issues.length === before ? cloneJson(fields as JsonValue) as JsonObject : undefined
}

/** 读取 JSON 对象并深拷贝。 */
function readData(sink: Sink, value: unknown, path: JsonPath): JsonObject | undefined {
  const fields = readObject(sink, value, path)
  if (!fields || readJson(sink, fields, path) === undefined)
    return undefined
  return cloneJson(fields as JsonValue) as JsonObject
}

function readNode(sink: Sink, value: unknown, path: JsonPath): FlowNode | undefined {
  const fields = readObject(sink, value, path, { required: ['id', 'type', 'x', 'y', 'width', 'height'], allowed: NODE_KEYS })
  if (!fields)
    return undefined
  const id = readString(sink, fields.id, [...path, 'id'], { nonEmpty: true })
  const type = readString(sink, fields.type, [...path, 'type'], { nonEmpty: true })
  const x = readNumber(sink, fields.x, [...path, 'x'])
  const y = readNumber(sink, fields.y, [...path, 'y'])
  const width = readNumber(sink, fields.width, [...path, 'width'], { min: 0 })
  const height = readNumber(sink, fields.height, [...path, 'height'], { min: 0 })
  const label = readString(sink, fields.label, [...path, 'label'])
  const data = readData(sink, fields.data, [...path, 'data'])
  const extensions = readExtensions(sink, fields.extensions, [...path, 'extensions'])
  if (id === undefined || type === undefined || x === undefined || y === undefined || width === undefined || height === undefined)
    return undefined
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    ...(label === undefined ? {} : { label }),
    ...(data === undefined ? {} : { data }),
    ...(extensions === undefined ? {} : { extensions }),
  }
}

function readEdge(sink: Sink, value: unknown, path: JsonPath): FlowEdge | undefined {
  const fields = readObject(sink, value, path, { required: ['id', 'source', 'target'], allowed: EDGE_KEYS })
  if (!fields)
    return undefined
  const id = readString(sink, fields.id, [...path, 'id'], { nonEmpty: true })
  const source = readEndpoint(sink, fields.source, [...path, 'source'])
  const target = readEndpoint(sink, fields.target, [...path, 'target'])
  const label = readString(sink, fields.label, [...path, 'label'])
  const style = readStyle(sink, fields.style, [...path, 'style'])
  const data = readData(sink, fields.data, [...path, 'data'])
  const vertices = readItems(sink, fields.vertices, [...path, 'vertices'], readPoint)
  const extensions = readExtensions(sink, fields.extensions, [...path, 'extensions'])
  if (id === undefined || source === undefined || target === undefined)
    return undefined
  return {
    id,
    source,
    target,
    ...(label === undefined ? {} : { label }),
    ...(style === undefined ? {} : { style }),
    ...(data === undefined ? {} : { data }),
    ...(vertices === undefined ? {} : { vertices }),
    ...(extensions === undefined ? {} : { extensions }),
  }
}

function readEndpoint(sink: Sink, value: unknown, path: JsonPath): FlowEndpoint | undefined {
  const fields = readObject(sink, value, path, { required: ['node'], allowed: ENDPOINT_KEYS })
  if (!fields)
    return undefined
  const node = readString(sink, fields.node, [...path, 'node'], { nonEmpty: true })
  const port = readString(sink, fields.port, [...path, 'port'], { nonEmpty: true })
  if (node === undefined)
    return undefined
  return port === undefined ? { node } : { node, port }
}

function readStyle(sink: Sink, value: unknown, path: JsonPath): FlowEdgeStyle | undefined {
  const fields = readObject(sink, value, path, { allowed: STYLE_KEYS })
  if (!fields)
    return undefined
  const dashed = readBoolean(sink, fields.dashed, [...path, 'dashed'])
  return dashed === undefined ? {} : { dashed }
}

function readPoint(sink: Sink, value: unknown, path: JsonPath): FlowPoint | undefined {
  const fields = readObject(sink, value, path, { required: ['x', 'y'], allowed: POINT_KEYS })
  if (!fields)
    return undefined
  const x = readNumber(sink, fields.x, [...path, 'x'])
  const y = readNumber(sink, fields.y, [...path, 'y'])
  if (x === undefined || y === undefined)
    return undefined
  return { x, y }
}
