/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowIssue, FlowSchemaIssueCode } from './issues'
import type { JsonObject, JsonValue } from './json'
import type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowEndpoint, FlowNode, FlowPoint } from './schema'
import { appendPointer, cloneJson, findJsonViolation, isPlainObject } from './json'
import { FLOW_DOCUMENT_VERSION } from './schema'

/** 读取结果：成功时给出规范化后的文档副本，失败时给出全部结构问题。 */
export type FlowReadResult
  = | { readonly ok: true, readonly document: FlowDocument }
    | { readonly ok: false, readonly issues: readonly FlowIssue[] }

/** 结构问题参数 expected 的取值。 */
export type FlowSchemaExpectation
  = | 'object'
    | 'array'
    | 'string'
    | 'non-empty-string'
    | 'finite-number'
    | 'non-negative-number'
    | 'boolean'
    | 'json'

const DOCUMENT_KEYS = ['version', 'nodes', 'edges', 'data'] as const
const NODE_KEYS = ['id', 'type', 'x', 'y', 'width', 'height', 'label', 'data'] as const
const EDGE_KEYS = ['id', 'source', 'target', 'label', 'style', 'data', 'vertices'] as const
const ENDPOINT_KEYS = ['node', 'port'] as const
const STYLE_KEYS = ['dashed'] as const
const POINT_KEYS = ['x', 'y'] as const

type Fields = Record<string, unknown>

/**
 * 把未知输入读成文档：逐项检查字段类型、必填项与多余字段，返回不与输入共享引用的副本。
 * 只检查结构；重复 id、悬空引用等语义问题由 validateDocument 负责。
 */
export function readDocument(value: unknown): FlowReadResult {
  const reader = new SchemaReader()
  const fields = reader.object(value, '', DOCUMENT_KEYS, ['version', 'nodes', 'edges'])
  if (!fields)
    return { ok: false, issues: reader.issues }

  const version = fields.version
  if (version !== undefined && version !== FLOW_DOCUMENT_VERSION) {
    if (typeof version === 'number' && Number.isFinite(version)) {
      reader.report('document.unsupported-version', { version, supported: FLOW_DOCUMENT_VERSION })
      return { ok: false, issues: reader.issues }
    }
    reader.mismatch('/version', 'finite-number')
  }

  const nodes = reader.array(fields.nodes, '/nodes', (item, pointer) => readNode(reader, item, pointer))
  const edges = reader.array(fields.edges, '/edges', (item, pointer) => readEdge(reader, item, pointer))
  const data = reader.optionalJsonObject(fields.data, '/data')

  if (reader.issues.length > 0 || !nodes || !edges)
    return { ok: false, issues: reader.issues }

  const document: FlowDocument = data === undefined
    ? { version: FLOW_DOCUMENT_VERSION, nodes, edges }
    : { version: FLOW_DOCUMENT_VERSION, nodes, edges, data }
  return { ok: true, document }
}

function readNode(reader: SchemaReader, value: unknown, pointer: string): FlowNode | undefined {
  const fields = reader.object(value, pointer, NODE_KEYS, ['id', 'type', 'x', 'y', 'width', 'height'])
  if (!fields)
    return undefined
  const id = reader.nonEmptyString(fields.id, appendPointer(pointer, 'id'))
  const type = reader.nonEmptyString(fields.type, appendPointer(pointer, 'type'))
  const x = reader.finiteNumber(fields.x, appendPointer(pointer, 'x'))
  const y = reader.finiteNumber(fields.y, appendPointer(pointer, 'y'))
  const width = reader.nonNegativeNumber(fields.width, appendPointer(pointer, 'width'))
  const height = reader.nonNegativeNumber(fields.height, appendPointer(pointer, 'height'))
  const label = reader.optionalString(fields.label, appendPointer(pointer, 'label'))
  const data = reader.optionalJsonObject(fields.data, appendPointer(pointer, 'data'))
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
  }
}

function readEdge(reader: SchemaReader, value: unknown, pointer: string): FlowEdge | undefined {
  const fields = reader.object(value, pointer, EDGE_KEYS, ['id', 'source', 'target'])
  if (!fields)
    return undefined
  const id = reader.nonEmptyString(fields.id, appendPointer(pointer, 'id'))
  const source = readEndpoint(reader, fields.source, appendPointer(pointer, 'source'))
  const target = readEndpoint(reader, fields.target, appendPointer(pointer, 'target'))
  const label = reader.optionalString(fields.label, appendPointer(pointer, 'label'))
  const style = fields.style === undefined ? undefined : readStyle(reader, fields.style, appendPointer(pointer, 'style'))
  const data = reader.optionalJsonObject(fields.data, appendPointer(pointer, 'data'))
  const vertices = fields.vertices === undefined
    ? undefined
    : reader.array(fields.vertices, appendPointer(pointer, 'vertices'), (item, itemPointer) => readPoint(reader, item, itemPointer))
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
  }
}

function readEndpoint(reader: SchemaReader, value: unknown, pointer: string): FlowEndpoint | undefined {
  const fields = reader.object(value, pointer, ENDPOINT_KEYS, ['node'])
  if (!fields)
    return undefined
  const node = reader.nonEmptyString(fields.node, appendPointer(pointer, 'node'))
  const port = fields.port === undefined ? undefined : reader.nonEmptyString(fields.port, appendPointer(pointer, 'port'))
  if (node === undefined)
    return undefined
  return port === undefined ? { node } : { node, port }
}

function readStyle(reader: SchemaReader, value: unknown, pointer: string): FlowEdgeStyle | undefined {
  const fields = reader.object(value, pointer, STYLE_KEYS, [])
  if (!fields)
    return undefined
  const dashed = reader.optionalBoolean(fields.dashed, appendPointer(pointer, 'dashed'))
  return dashed === undefined ? {} : { dashed }
}

function readPoint(reader: SchemaReader, value: unknown, pointer: string): FlowPoint | undefined {
  const fields = reader.object(value, pointer, POINT_KEYS, ['x', 'y'])
  if (!fields)
    return undefined
  const x = reader.finiteNumber(fields.x, appendPointer(pointer, 'x'))
  const y = reader.finiteNumber(fields.y, appendPointer(pointer, 'y'))
  if (x === undefined || y === undefined)
    return undefined
  return { x, y }
}

/** 收集结构问题的读取器。 */
class SchemaReader {
  readonly issues: FlowIssue[] = []

  report(code: FlowSchemaIssueCode, params: JsonObject): void {
    this.issues.push({ code, severity: 'error', location: { kind: 'document' }, params })
  }

  mismatch(pointer: string, expected: FlowSchemaExpectation): void {
    this.report('schema.type-mismatch', { pointer, expected })
  }

  /** 读取普通对象，报告缺失的必填字段与未登记字段；值为 undefined 的字段视为缺省。 */
  object(value: unknown, pointer: string, allowed: readonly string[], required: readonly string[]): Fields | undefined {
    if (!isPlainObject(value)) {
      this.mismatch(pointer, 'object')
      return undefined
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key))
        this.report('schema.unknown-field', { pointer: appendPointer(pointer, key) })
    }
    for (const key of required) {
      if (value[key] === undefined)
        this.report('schema.missing-field', { pointer: appendPointer(pointer, key) })
    }
    return value
  }

  /** 读取数组，任一元素失败时返回 undefined。 */
  array<T>(value: unknown, pointer: string, readItem: (item: unknown, pointer: string) => T | undefined): T[] | undefined {
    if (value === undefined)
      return undefined
    if (!Array.isArray(value)) {
      this.mismatch(pointer, 'array')
      return undefined
    }
    const result: T[] = []
    let failed = false
    value.forEach((item, index) => {
      const read = readItem(item, appendPointer(pointer, index))
      if (read === undefined)
        failed = true
      else
        result.push(read)
    })
    return failed ? undefined : result
  }

  nonEmptyString(value: unknown, pointer: string): string | undefined {
    if (value === undefined)
      return undefined
    if (typeof value !== 'string' || value.length === 0) {
      this.mismatch(pointer, 'non-empty-string')
      return undefined
    }
    return value
  }

  optionalString(value: unknown, pointer: string): string | undefined {
    if (value === undefined)
      return undefined
    if (typeof value !== 'string') {
      this.mismatch(pointer, 'string')
      return undefined
    }
    return value
  }

  optionalBoolean(value: unknown, pointer: string): boolean | undefined {
    if (value === undefined)
      return undefined
    if (typeof value !== 'boolean') {
      this.mismatch(pointer, 'boolean')
      return undefined
    }
    return value
  }

  finiteNumber(value: unknown, pointer: string): number | undefined {
    if (value === undefined)
      return undefined
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.mismatch(pointer, 'finite-number')
      return undefined
    }
    return value
  }

  nonNegativeNumber(value: unknown, pointer: string): number | undefined {
    if (value === undefined)
      return undefined
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      this.mismatch(pointer, 'non-negative-number')
      return undefined
    }
    return value
  }

  /** 读取 JSON 对象并深拷贝；内部出现非 JSON 值时报告其位置。 */
  optionalJsonObject(value: unknown, pointer: string): JsonObject | undefined {
    if (value === undefined)
      return undefined
    if (!isPlainObject(value)) {
      this.mismatch(pointer, 'object')
      return undefined
    }
    const violation = findJsonViolation(value, pointer)
    if (violation !== undefined) {
      this.mismatch(violation, 'json')
      return undefined
    }
    return cloneJson(value as JsonValue) as JsonObject
  }
}
