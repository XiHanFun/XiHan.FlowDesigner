/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowCoreExtension, FlowDocument, FlowEdge, FlowIssue, FlowNode, FlowNodeTypeDefinition } from '../src'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { checkConnection, createFlowModel, createNodeTypeRegistry, DEFAULT_ISSUE_SEVERITY, resolveEndpointPort, validateDocument } from '../src'

const size = { width: 100, height: 40 }

const nodeTypes: readonly FlowNodeTypeDefinition[] = [
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
]
const registry = createNodeTypeRegistry(nodeTypes)
const extensions: readonly FlowCoreExtension[] = [{ id: 'test', nodeTypes }]

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
    const location = issue.target === undefined
      ? 'doc'
      : `${issue.target.kind}:${issue.target.id}${issue.path.length > 2 ? `.${String(issue.path[2])}` : ''}`
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
    expect(validateDocument(chain(), { extensions })).toEqual([])
  })

  it('重复 id 与未知类型', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t', 'task'), node('t', 'task'), node('x', 'ghost')],
      [edge('e1', 's', 't'), edge('e1', 't', 'x')],
    ), { extensions })
    expect(issues.slice(0, 3)).toEqual([
      { code: 'node.duplicate-id', severity: 'error', path: ['nodes', 2], target: { kind: 'node', id: 't' }, params: { id: 't' } },
      { code: 'node.unknown-type', severity: 'error', path: ['nodes', 3], target: { kind: 'node', id: 'x' }, params: { type: 'ghost' } },
      { code: 'edge.duplicate-id', severity: 'error', path: ['edges', 1], target: { kind: 'edge', id: 'e1' }, params: { id: 'e1' } },
    ])
  })

  it('悬空引用按端报告', () => {
    const issues = validateDocument(doc([node('s', 'start')], [edge('e1', 's', 'missing'), edge('e2', 'gone', 's')]), { extensions })
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
    ), { extensions })
    expect(brief(issues)).toEqual([
      'edge.invalid-direction@edge:e1.target',
      'edge.unknown-port@edge:e2.source',
      'edge.invalid-direction@edge:e3.source',
      'edge.invalid-direction@edge:e3.target',
    ])
    expect(issues[0]!.params).toEqual({ port: 'yes' })
    expect(issues[1]!.params).toEqual({ port: 'maybe' })
    expect(issues[2]!.params).toBeUndefined()
  })

  it('无端口的节点不参与连通性检查', () => {
    expect(validateDocument(doc([...chain().nodes, node('n', 'note')], chain().edges), { extensions })).toEqual([])
  })

  it('自环缺省不允许，类型声明后允许', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t', 'task'), node('l', 'loop')],
      [edge('e1', 's', 't'), edge('e2', 't', 't'), edge('e3', 't', 'l'), edge('e4', 'l', 'l')],
    ), { extensions })
    expect(brief(issues)).toEqual(['edge.self-loop@edge:e2'])
    expect(issues[0]!.params).toEqual({ node: 't' })
  })

  it('允许连向与允许连入的类型', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('l', 'loop'), node('t', 'task'), node('k', 'sink')],
      [edge('e1', 's', 'l'), edge('e2', 'l', 't'), edge('e3', 's', 'k')],
    ), { extensions })
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
    ), { extensions })
    const limits = issues.filter(issue => ['node.max-incoming', 'node.max-outgoing', 'port.max-connections'].includes(issue.code))
    expect(limits).toEqual([
      { code: 'node.max-incoming', severity: 'error', path: ['nodes', 3], target: { kind: 'node', id: 'k' }, params: { max: 1, count: 2 } },
      { code: 'port.max-connections', severity: 'error', path: ['nodes', 4], target: { kind: 'node', id: 'g' }, params: { port: 'yes', max: 1, count: 2 } },
      { code: 'node.max-outgoing', severity: 'error', path: ['nodes', 7], target: { kind: 'node', id: 'l' }, params: { max: 1, count: 2 } },
    ])
  })

  it('未指定端口的端点按方向计入默认端口', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('g', 'gate'), node('e1', 'end'), node('e2', 'end')],
      [edge('a', 's', 'g'), edge('b', 'g', 'e1'), edge('c', 'g', 'e2', { source: { node: 'g', port: 'yes' } })],
    ), { extensions })
    expect(brief(issues)).toEqual(['port.max-connections@node:g'])
  })

  it('类型个数上下限', () => {
    expect(validateDocument(doc([node('t', 'task')]), { extensions }).filter(issue => issue.target === undefined)).toEqual([
      { code: 'type.min-count', severity: 'error', path: [], params: { type: 'start', min: 1, count: 0 } },
    ])
    const twoStarts = validateDocument(doc([node('a', 'start'), node('b', 'start'), node('e', 'end')], [edge('x', 'a', 'e'), edge('y', 'b', 'e')]), { extensions })
    expect(twoStarts).toEqual([
      { code: 'type.max-count', severity: 'error', path: [], params: { type: 'start', max: 1, count: 2 } },
    ])
  })

  it('孤立、缺少入线或出线', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('t', 'task'), node('lonely', 'task'), node('u', 'task'), node('e', 'end'), node('k', 'sink')],
      [edge('a', 's', 't'), edge('b', 'u', 'e'), edge('c', 't', 'k')],
    ), { extensions })
    expect(brief(issues)).toEqual([
      'node.isolated@node:lonely',
      'node.missing-incoming@node:u',
      'node.unreachable@node:u',
      'node.unreachable@node:e',
    ])
    expect(issues.every(issue => issue.severity === 'warning')).toBe(true)
  })

  it('只有入口类型才是可达性起点，无入口节点时不报告不可达', () => {
    const noEntry: readonly FlowCoreExtension[] = [{ id: 'test', nodeTypes: [{ type: 'task', size, ports: 'both', terminal: true }] }]
    const issues = validateDocument(doc([node('a', 'task'), node('b', 'task')], [edge('x', 'a', 'b')]), { extensions: noEntry })
    expect(brief(issues)).toEqual(['node.missing-incoming@node:a'])
  })

  it('环路上的节点从入口可达', () => {
    const issues = validateDocument(doc(
      [node('s', 'start'), node('a', 'task'), node('b', 'task'), node('e', 'end')],
      [edge('1', 's', 'a'), edge('2', 'a', 'b'), edge('3', 'b', 'a'), edge('4', 'b', 'e')],
    ), { extensions })
    expect(issues).toEqual([])
  })

  it('节点属性：显示中的必填与编辑方式的取值，登记的编辑方式交给它的 check', () => {
    const typed: readonly FlowCoreExtension[] = [{
      id: 'test',
      controls: { assignees: { check: value => (Array.isArray(value) ? undefined : 'invalid-value') } },
      nodeTypes: [{
        type: 'task',
        size,
        ports: 'none',
        properties: [
          { path: ['data', 'props', 'url'], control: { kind: 'text' }, required: true },
          { path: ['data', 'props', 'fallback'], control: { kind: 'text' }, required: true, visibleWhen: { path: ['data', 'props', 'mode'], equals: 'fallback' } },
          { path: ['data', 'props', 'retries'], control: { kind: 'number', integer: true, min: 0 } },
          { path: ['data', 'props', 'rules'], control: { kind: 'assignees' } },
        ],
      }],
    }]
    const issues = validateDocument(doc([
      node('a', 'task'),
      node('b', 'task', { data: { props: { url: 'x', mode: 'fallback', fallback: '' } } }),
      node('c', 'task', { data: { props: { url: 'x', mode: 'other', retries: 1.5, rules: 'anything' } } }),
    ]), { extensions: typed })
    expect(issues).toEqual([
      { code: 'required', severity: 'error', path: ['nodes', 0, 'data', 'props', 'url'], target: { kind: 'node', id: 'a' } },
      { code: 'required', severity: 'error', path: ['nodes', 1, 'data', 'props', 'fallback'], target: { kind: 'node', id: 'b' } },
      { code: 'not-integer', severity: 'error', path: ['nodes', 2, 'data', 'props', 'retries'], target: { kind: 'node', id: 'c' } },
      { code: 'invalid-value', severity: 'error', path: ['nodes', 2, 'data', 'props', 'rules'], target: { kind: 'node', id: 'c' } },
    ])
  })

  it('没登记的编辑方式报 unknown-control', () => {
    const untyped: readonly FlowCoreExtension[] = [{ id: 'test', nodeTypes: [{ type: 'task', size, ports: 'none', properties: [{ path: ['data', 'who'], control: { kind: 'assignees' } }] }] }]
    expect(brief(validateDocument(doc([node('a', 'task', { data: { who: [] } })]), { extensions: untyped }))).toEqual(['unknown-control@node:a.data'])
  })

  it('连线属性：内置的标签与虚线、扩展追加的，加上源节点类型的 outgoingEdges；重复 id 的连线只查第一条', () => {
    const document = doc(
      [node('s', 'start'), node('t', 'task'), node('g', 'gate')],
      [
        edge('a', 's', 't', { style: { dashed: 'yes' as never } }),
        edge('b', 's', 't', { label: 'ok', data: { weight: 'heavy' } }),
        edge('a', 's', 't'),
        { id: 'c', source: { node: 'g', port: 'yes' }, target: { node: 't' } },
      ],
    )
    const withEdges: readonly FlowCoreExtension[] = [{
      id: 'test',
      nodeTypes: nodeTypes.map(type => (type.type === 'gate' ? { ...type, outgoingEdges: [{ path: ['data', 'condition'], control: { kind: 'text' }, required: true }] } : type)),
      edgeProperties: [{ path: ['data', 'weight'], control: { kind: 'number' } }],
    }]
    const issues = validateDocument(document, { extensions: withEdges })
    expect(issues.filter(issue => issue.target?.kind === 'edge' && !issue.code.startsWith('edge.'))).toEqual([
      { code: 'invalid-type', severity: 'error', path: ['edges', 0, 'style', 'dashed'], target: { kind: 'edge', id: 'a' } },
      { code: 'invalid-type', severity: 'error', path: ['edges', 1, 'data', 'weight'], target: { kind: 'edge', id: 'b' } },
      { code: 'required', severity: 'error', path: ['edges', 3, 'data', 'condition'], target: { kind: 'edge', id: 'c' } },
    ])
  })

  it('流程定义级属性与扩展数据的形状', () => {
    const settings: readonly FlowCoreExtension[] = [{ id: 'test', nodeTypes, documentProperties: [{ path: ['data', 'name'], control: { kind: 'text' }, required: true }] }]
    const base = chain()
    const document: FlowDocument = { ...base, extensions: { 'my-app': 1 as never }, nodes: base.nodes.map(item => (item.id === 't' ? { ...item, extensions: [] as never } : item)) }
    expect(validateDocument(document, { extensions: settings }).map(issue => [issue.code, issue.path, issue.target?.id])).toEqual([
      ['required', ['data', 'name'], undefined],
      ['invalid-type', ['extensions', 'my-app'], undefined],
      ['invalid-type', ['nodes', 1, 'extensions'], 't'],
    ])
  })

  it('扩展的规则逐条跑，问题与内置的一起定严重程度', () => {
    const ruled: readonly FlowCoreExtension[] = [{
      id: '@acme/limits',
      nodeTypes,
      rules: [(document, context) => (document.nodes.length > 2 ? [{ code: 'limits.too-many', path: ['nodes'], params: { types: context.nodeTypes.types.length } }] : [])],
    }]
    expect(validateDocument(chain(), { extensions: ruled, severity: { 'limits.too-many': 'warning' } })).toEqual([
      { code: 'limits.too-many', severity: 'warning', path: ['nodes'], params: { types: 7 } },
    ])
  })

  it('扩展冲突在合出模型时抛错：节点类型重名、连线属性与内置或源节点类型的出线属性同路径', () => {
    expect(() => validateDocument(chain(), { extensions: [...extensions, { id: 'again', nodeTypes: [nodeTypes[0]!] }] })).toThrow(DesignerExtensionError)
    expect(() => createFlowModel([{ id: 'x', edgeProperties: [{ path: ['label'], control: { kind: 'text' } }] }])).toThrow(DesignerExtensionError)
    expect(() => createFlowModel([{ id: 'x', nodeTypes: [{ type: 'g', size, ports: 'both', outgoingEdges: [{ path: ['style', 'dashed'], control: { kind: 'boolean' } }] }] }]))
      .toThrow(DesignerExtensionError)
    const model = createFlowModel(extensions)
    expect(createFlowModel(extensions)).toBe(model)
    expect(model.edgePropertiesOf('gate').map(descriptor => descriptor.path)).toEqual([['label'], ['style', 'dashed']])
  })

  it('按问题码覆盖严重程度或关闭', () => {
    const document = doc([node('s', 'start'), node('t', 'task'), node('lonely', 'task')], [edge('a', 's', 't')])
    const issues = validateDocument(document, { extensions, severity: { 'node.isolated': 'error', 'node.missing-outgoing': 'off' } })
    expect(issues.map(issue => [issue.code, issue.severity])).toEqual([['node.isolated', 'error']])
  })

  it('缺省严重程度表覆盖全部校验问题码', () => {
    expect(Object.keys(DEFAULT_ISSUE_SEVERITY)).toHaveLength(25)
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
