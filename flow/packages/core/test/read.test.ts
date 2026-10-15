/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowIssue } from '../src'
import { formatJsonPath } from '@xihan-ui/core/json'
import { describe, expect, it } from 'vitest'
import { createDocument, FLOW_DOCUMENT_VERSION, readDocument } from '../src'

function issuesOf(value: unknown): readonly FlowIssue[] {
  const result = readDocument(value)
  if (result.ok)
    throw new Error('expected read to fail')
  return result.issues
}

function summary(issues: readonly FlowIssue[]): string[] {
  return issues.map(issue => `${issue.code} ${formatJsonPath(issue.path)} ${String(issue.params?.expected ?? issue.params?.pointer ?? '')}`.trim())
}

const fullDocument = {
  version: 1,
  nodes: [
    { id: 'a', type: 'task', x: 10, y: -20.5, width: 120, height: 48, label: '审批', data: { assignees: ['u1'], retry: { max: 3 } } },
    { id: 'b', type: 'end', x: 300, y: 0, width: 0, height: 0 },
  ],
  edges: [
    {
      id: 'e1',
      source: { node: 'a', port: 'out' },
      target: { node: 'b' },
      label: 'ok',
      style: { dashed: true },
      data: { condition: 'amount > 100', priority: 1 },
      vertices: [{ x: 200, y: 0 }],
    },
  ],
  data: { code: 'leave', variables: [{ name: 'days', required: true }] },
}

describe('readDocument', () => {
  it('读出完整文档并返回不共享引用的副本', () => {
    const input = JSON.parse(JSON.stringify(fullDocument)) as typeof fullDocument
    const result = readDocument(input)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.document).toEqual(fullDocument)
    expect(result.document.nodes[0]!.data).not.toBe(input.nodes[0]!.data)
    expect(result.document.edges[0]!.vertices).not.toBe(input.edges[0]!.vertices)
    expect(result.document.data).not.toBe(input.data)
  })

  it('经 JSON 序列化往返后内容不变', () => {
    const result = readDocument(JSON.parse(JSON.stringify(fullDocument)))
    expect(result.ok && result.document).toEqual(fullDocument)
  })

  it('读出空文档', () => {
    expect(readDocument(createDocument())).toEqual({ ok: true, document: { version: FLOW_DOCUMENT_VERSION, nodes: [], edges: [] } })
  })

  it('值为 undefined 的可选字段视为缺省', () => {
    const result = readDocument({ version: 1, nodes: [{ id: 'a', type: 't', x: 0, y: 0, width: 1, height: 1, label: undefined }], edges: [], data: undefined })
    expect(result.ok && result.document).toEqual({ version: 1, nodes: [{ id: 'a', type: 't', x: 0, y: 0, width: 1, height: 1 }], edges: [] })
  })

  it('根不是对象', () => {
    expect(summary(issuesOf([]))).toEqual(['invalid-type  object'])
    expect(summary(issuesOf(null))).toEqual(['invalid-type  object'])
  })

  it('报告缺失字段与多余字段', () => {
    expect(summary(issuesOf({ nodes: [], extra: 1 }))).toEqual([
      'unknown-key extra',
      'required version',
      'required edges',
    ])
  })

  it('不支持的版本只报告版本问题', () => {
    const issues = issuesOf({ version: 2, nodes: 'x', edges: [] })
    expect(issues).toEqual([{ code: 'document.unsupported-version', path: ['version'], params: { version: 2, supported: 1 } }])
  })

  it('版本不是数字', () => {
    expect(summary(issuesOf({ version: '1', nodes: [], edges: [] }))).toEqual(['invalid-type version number'])
  })

  it('逐项报告节点字段问题', () => {
    const issues = issuesOf({
      version: 1,
      nodes: [{ id: '', type: 1, x: Number.NaN, y: '0', width: -1, height: 1, label: 2, data: [], color: 'red' }],
      edges: [],
    })
    expect(summary(issues)).toEqual([
      'unknown-key nodes[0].color',
      'empty nodes[0].id',
      'invalid-type nodes[0].type string',
      'invalid-type nodes[0].x number',
      'invalid-type nodes[0].y number',
      'out-of-range nodes[0].width',
      'invalid-type nodes[0].label string',
      'invalid-type nodes[0].data object',
    ])
  })

  it('报告 data 内部第一处非 JSON 值', () => {
    const issues = issuesOf({
      version: 1,
      nodes: [{ id: 'a', type: 't', x: 0, y: 0, width: 1, height: 1, data: { list: [1, Number.POSITIVE_INFINITY] } }],
      edges: [],
      data: { when: new Date(0) },
    })
    expect(summary(issues)).toEqual([
      'invalid-value nodes[0].data /list/1',
      'invalid-value data /when',
    ])
  })

  it('逐项报告连线字段问题', () => {
    const issues = issuesOf({
      version: 1,
      nodes: [],
      edges: [
        { id: 'e', source: 'a', target: { port: 'in' }, style: { dashed: 'yes', color: 1 }, vertices: [{ x: 0 }, 3] },
        { id: 'f', source: { node: 'a', port: '' }, target: { node: 'b' } },
      ],
    })
    expect(summary(issues)).toEqual([
      'invalid-type edges[0].source object',
      'required edges[0].target.node',
      'unknown-key edges[0].style.color',
      'invalid-type edges[0].style.dashed boolean',
      'required edges[0].vertices[0].y',
      'invalid-type edges[0].vertices[1] object',
      'empty edges[1].source.port',
    ])
  })

  it('nodes 与 edges 必须是数组', () => {
    expect(summary(issuesOf({ version: 1, nodes: {}, edges: 'x' }))).toEqual([
      'invalid-type nodes array',
      'invalid-type edges array',
    ])
  })

  it('结构问题不写严重程度（按 error 处理），路径从文档根算起', () => {
    const issues = issuesOf({ version: 1, nodes: [{}], edges: [] })
    expect(issues.map(issue => formatJsonPath(issue.path))).toEqual(['nodes[0].id', 'nodes[0].type', 'nodes[0].x', 'nodes[0].y', 'nodes[0].width', 'nodes[0].height'])
    for (const issue of issues) {
      expect(issue.code).toBe('required')
      expect(issue.severity).toBeUndefined()
    }
  })
})
