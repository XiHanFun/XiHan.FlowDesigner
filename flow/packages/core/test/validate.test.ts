/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowEdge, FlowIssue, FlowNode, FlowNodeTypeDefinition } from '../src'
import { describe, expect, it } from 'vitest'
import { checkConnection, createNodeTypeRegistry, DEFAULT_ISSUE_SEVERITY, resolveEndpointPort, validateDocument } from '../src'

const size = { width: 100, height: 40 }

const registry = createNodeTypeRegistry([
  { type: 'start', size, ports: 'out', entry: true, minCount: 1, maxCount: 1 },
  { type: 'task', size, ports: 'both' },
  { type: 'end', size, ports: 'in', terminal: true },
  { type: 'note', size, ports: 'none' },
  {
    type: 'gate',
    size,
    ports: [
      { id: 'in', direction: 'in', side: 'top' },
      { id: 'yes', direction: 'out', side: 'right', maxConnections: 1 },
      { id: 'no', direction: 'out', side: 'bottom', maxConnections: 1 },
    ],
  },
  { type: 'sink', size, ports: 'both', terminal: true, connection: { maxIncoming: 1, allowedSources: ['task'] } },
  { type: 'loop', size, ports: 'both', connection: { allowSelfLoop: true, maxOutgoing: 1, allowedTargets: ['loop', 'end'] } },
])

function node(id: string, type: string, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type, x: 0, y: 0, width: 100, height: 40, ...extra }
}

function edge(id: string, source: string, target: string, extra: Partial<FlowEdge> = {}): FlowEdge {
  return { id, source: { node: source }, target: { node: target }, ...extra }
}

function doc(nodes: readonly FlowNode[], edges: readonly FlowEdge[] = []): FlowDocument {
  return { version: 1, nodes, edges }
}

function brief(issues: readonly FlowIssue[]): string[] {
  return issues.map((issue) => {
    const location = issue.location.kind === 'document'
      ? 'doc'
      : `${issue.location.kind}:${issue.location.id}${issue.location.kind === 'edge' && issue.location.end ? `.${issue.location.end}` : ''}`
    return `${issue.code}@${location}`
  })
}

function chain(): FlowDocument {
  return doc(
    [node('s', 'start'), node('t', 'task'), node('e', 'end')],
    [edge('e1', 's', 't'), edge('e2', 't', 'e')],
  )
}

describe('validateDocument', () => {
  it('合法文档没有问题', () => {
    expect(validateDocument(chain(), registry)).toEqual([])
  })

  it('重复 id 与未知类型', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t', 'task'), node('t', 'task'), node('x', 'ghost')],
      [edge('e1', 's', 't'), edge('e1', 't', 'x')],
    ), registry)
    expect(issues.slice(0, 3)).toEqual([
      { code: 'node.duplicate-id', severity: 'error', location: { kind: 'node', id: 't', index: 2 }, params: { id: 't' } },
      { code: 'node.unknown-type', severity: 'error', location: { kind: 'node', id: 'x', index: 3 }, params: { type: 'ghost' } },
      { code: 'edge.duplicate-id', severity: 'error', location: { kind: 'edge', id: 'e1', index: 1 }, params: { id: 'e1' } },
    ])
  })

  it('悬空引用按端报告', () => {
    const issues = validateDocument(doc([node('s', 'start')], [edge('e1', 's', 'missing'), edge('e2', 'gone', 's')]), registry)
    expect(brief(issues)).toEqual([
      'edge.dangling@edge:e1.target',
      'edge.dangling@edge:e2.source',
      'edge.invalid-direction@edge:e2.target',
    ])
    expect(issues[0]!.params).toEqual({ node: 'missing' })
  })

  it('端口不存在与方向不符', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('g', 'gate'), node('e', 'end')],
      [
        edge('e1', 's', 'g', { target: { node: 'g', port: 'yes' } }),
        edge('e2', 'g', 'e', { source: { node: 'g', port: 'maybe' } }),
        edge('e3', 'e', 's'),
      ],
    ), registry)
    expect(brief(issues)).toEqual([
      'edge.invalid-direction@edge:e1.target',
      'edge.unknown-port@edge:e2.source',
      'edge.invalid-direction@edge:e3.source',
      'edge.invalid-direction@edge:e3.target',
    ])
    expect(issues[0]!.params).toEqual({ port: 'yes' })
    expect(issues[1]!.params).toEqual({ port: 'maybe' })
    expect(issues[2]!.params).toEqual({})
  })

  it('无端口的节点不参与连通性检查', () => {
    expect(validateDocument(doc([...chain().nodes, node('n', 'note')], chain().edges), registry)).toEqual([])
  })

  it('自环缺省不允许，类型声明后允许', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t', 'task'), node('l', 'loop')],
      [edge('e1', 's', 't'), edge('e2', 't', 't'), edge('e3', 't', 'l'), edge('e4', 'l', 'l')],
    ), registry)
    expect(brief(issues)).toEqual(['edge.self-loop@edge:e2'])
    expect(issues[0]!.params).toEqual({ node: 't' })
  })

  it('允许连向与允许连入的类型', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('l', 'loop'), node('t', 'task'), node('k', 'sink')],
      [edge('e1', 's', 'l'), edge('e2', 'l', 't'), edge('e3', 's', 'k')],
    ), registry)
    expect(brief(issues)).toContain('edge.target-not-allowed@edge:e2.target')
    expect(brief(issues)).toContain('edge.source-not-allowed@edge:e3.source')
    expect(issues.find(issue => issue.code === 'edge.target-not-allowed')!.params).toEqual({ sourceType: 'loop', targetType: 'task' })
  })

  it('入度、出度与端口连接数上限', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t1', 'task'), node('t2', 'task'), node('k', 'sink'), node('g', 'gate'), node('e1', 'end'), node('e2', 'end'), node('l', 'loop')],
      [
        edge('a', 's', 't1'),
        edge('b', 't1', 't2'),
        edge('c', 't1', 'k'),
        edge('d', 't2', 'k'),
        edge('f', 't2', 'g'),
        edge('g1', 'g', 'e1', { source: { node: 'g', port: 'yes' } }),
        edge('g2', 'g', 'e2', { source: { node: 'g', port: 'yes' } }),
        edge('h', 't2', 'l'),
        edge('i', 'l', 'e1'),
        edge('j', 'l', 'e2'),
      ],
    ), registry)
    const limits = issues.filter(issue => ['node.max-incoming', 'node.max-outgoing', 'port.max-connections'].includes(issue.code))
    expect(limits).toEqual([
      { code: 'node.max-incoming', severity: 'error', location: { kind: 'node', id: 'k', index: 3 }, params: { max: 1, count: 2 } },
      { code: 'port.max-connections', severity: 'error', location: { kind: 'node', id: 'g', index: 4 }, params: { port: 'yes', max: 1, count: 2 } },
      { code: 'node.max-outgoing', severity: 'error', location: { kind: 'node', id: 'l', index: 7 }, params: { max: 1, count: 2 } },
    ])
  })

  it('未指定端口的端点按方向计入默认端口', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('g', 'gate'), node('e1', 'end'), node('e2', 'end')],
      [edge('a', 's', 'g'), edge('b', 'g', 'e1'), edge('c', 'g', 'e2', { source: { node: 'g', port: 'yes' } })],
    ), registry)
    expect(brief(issues)).toEqual(['port.max-connections@node:g'])
  })

  it('类型个数上下限', () => {
    expect(validateDocument(doc([node('t', 'task')]), registry).filter(issue => issue.location.kind === 'document')).toEqual([
      { code: 'type.min-count', severity: 'error', location: { kind: 'document' }, params: { type: 'start', min: 1, count: 0 } },
    ])
    const twoStarts = validateDocument(doc([node('a', 'start'), node('b', 'start'), node('e', 'end')], [edge('x', 'a', 'e'), edge('y', 'b', 'e')]), registry)
    expect(twoStarts).toEqual([
      { code: 'type.max-count', severity: 'error', location: { kind: 'document' }, params: { type: 'start', max: 1, count: 2 } },
    ])
  })

  it('孤立、缺少入线或出线', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t', 'task'), node('lonely', 'task'), node('u', 'task'), node('e', 'end'), node('k', 'sink')],
      [edge('a', 's', 't'), edge('b', 'u', 'e'), edge('c', 't', 'k')],
    ), registry)
    expect(brief(issues)).toEqual([
      'node.isolated@node:lonely',
      'node.missing-incoming@node:u',
      'node.unreachable@node:u',
      'node.unreachable@node:e',
    ])
    expect(issues.every(issue => issue.severity === 'warning')).toBe(true)
  })

  it('只有入口类型才是可达性起点，无入口节点时不报告不可达', () => {
    const noEntry = createNodeTypeRegistry([{ type: 'task', size, ports: 'both', terminal: true }])
    const issues = validateDocument(doc([node('a', 'task'), node('b', 'task')], [edge('x', 'a', 'b')]), noEntry)
    expect(brief(issues)).toEqual(['node.missing-incoming@node:a'])
  })

  it('环路上的节点从入口可达', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('a', 'task'), node('b', 'task'), node('e', 'end')],
      [edge('1', 's', 'a'), edge('2', 'a', 'b'), edge('3', 'b', 'a'), edge('4', 'b', 'e')],
    ), registry)
    expect(issues).toEqual([])
  })

  it('显示中的必填属性', () => {
    const typed = createNodeTypeRegistry([{
      type: 'task',
      size,
      ports: 'none',
      properties: [
        { path: ['props', 'url'], editor: 'text', required: true },
        { path: ['props', 'fallback'], editor: 'text', required: true, visibleWhen: { path: ['props', 'mode'], equals: 'fallback' } },
        { path: ['props', 'note'], editor: 'text' },
      ],
    }])
    const issues = validateDocument(doc([
      node('a', 'task'),
      node('b', 'task', { data: { props: { url: 'x', mode: 'fallback', fallback: '' } } }),
      node('c', 'task', { data: { props: { url: 'x', mode: 'other' } } }),
    ]), typed)
    expect(issues).toEqual([
      { code: 'node.property-required', severity: 'error', location: { kind: 'node', id: 'a', index: 0 }, params: { path: ['props', 'url'] } },
      { code: 'node.property-required', severity: 'error', location: { kind: 'node', id: 'b', index: 1 }, params: { path: ['props', 'fallback'] } },
    ])
  })

  it('按问题码覆盖严重程度或关闭', () => {
    const document = doc([node('s', 'start'), node('t', 'task'), node('lonely', 'task')], [edge('a', 's', 't')])
    const issues = validateDocument(document, registry, { severity: { 'node.isolated': 'error', 'node.missing-outgoing': 'off' } })
    expect(issues.map(issue => [issue.code, issue.severity])).toEqual([['node.isolated', 'error']])
  })

  it('缺省严重程度表覆盖全部校验问题码', () => {
    expect(Object.keys(DEFAULT_ISSUE_SEVERITY)).toHaveLength(19)
  })
})

describe('checkConnection', () => {
  const base = (): FlowDocument => doc(
    [node('s', 'start'), node('t', 'task'), node('g', 'gate'), node('k', 'sink'), node('l', 'loop'), node('e', 'end'), node('x', 'ghost')],
    [edge('a', 's', 't'), edge('b', 't', 'g'), edge('c', 'g', 'e', { source: { node: 'g', port: 'yes' } }), edge('d', 't', 'k')],
  )

  it('允许时返回空数组', () => {
    expect(checkConnection(base(), registry, { node: 't' }, { node: 'e' })).toEqual([])
    expect(checkConnection(base(), registry, { node: 'g', port: 'no' }, { node: 'e' })).toEqual([])
  })

  it('节点不存在或类型未知', () => {
    expect(checkConnection(base(), registry, { node: 'none' }, { node: 'x' })).toEqual([
      { code: 'edge.dangling', end: 'source', params: { node: 'none' } },
      { code: 'node.unknown-type', end: 'target', params: { type: 'ghost' } },
    ])
  })

  it('端口问题', () => {
    expect(checkConnection(base(), registry, { node: 'e' }, { node: 'g', port: 'zz' })).toEqual([
      { code: 'edge.invalid-direction', end: 'source', params: {} },
      { code: 'edge.unknown-port', end: 'target', params: { port: 'zz' } },
    ])
  })

  it('自环与类型限制', () => {
    expect(checkConnection(base(), registry, { node: 't' }, { node: 't' })).toEqual([{ code: 'edge.self-loop', params: { node: 't' } }])
    expect(checkConnection(base(), registry, { node: 'l' }, { node: 'l' })).toEqual([])
    expect(checkConnection(base(), registry, { node: 'l' }, { node: 't' })).toEqual([
      { code: 'edge.target-not-allowed', end: 'target', params: { sourceType: 'loop', targetType: 'task' } },
    ])
  })

  it('连接数上限计入新连线', () => {
    expect(checkConnection(base(), registry, { node: 'g', port: 'yes' }, { node: 'e' })).toEqual([
      { code: 'port.max-connections', end: 'source', params: { port: 'yes', max: 1, count: 2 } },
    ])
    expect(checkConnection(base(), registry, { node: 't' }, { node: 'k' })).toEqual([
      { code: 'node.max-incoming', end: 'target', params: { max: 1, count: 2 } },
    ])
    const looped = doc([node('l', 'loop'), node('e', 'end')], [edge('a', 'l', 'e')])
    expect(checkConnection(looped, registry, { node: 'l' }, { node: 'e' })).toEqual([
      { code: 'node.max-outgoing', end: 'source', params: { max: 1, count: 2 } },
    ])
  })

  it('重新连接时排除被拖动的连线', () => {
    expect(checkConnection(base(), registry, { node: 'g', port: 'yes' }, { node: 'e' }, { ignoreEdge: 'c' })).toEqual([])
    expect(checkConnection(base(), registry, { node: 't' }, { node: 'k' }, { ignoreEdge: 'd' })).toEqual([])
  })
})

describe('resolveEndpointPort', () => {
  it('未指定端口时取第一个允许该端的端口', () => {
    const definitions: FlowNodeTypeDefinition[] = [{ type: 'a', size, ports: [{ id: 'io', direction: 'both', side: 'left' }, { id: 'o', direction: 'out', side: 'right' }] }]
    const type = createNodeTypeRegistry(definitions).get('a')!
    expect(resolveEndpointPort(type, { node: 'n' }, 'source')?.id).toBe('io')
    expect(resolveEndpointPort(type, { node: 'n', port: 'o' }, 'target')?.id).toBe('o')
    expect(resolveEndpointPort(type, { node: 'n', port: 'missing' }, 'source')).toBeUndefined()
  })
})
