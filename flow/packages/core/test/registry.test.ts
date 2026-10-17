/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowNodeTypeDefinition, FlowPort } from '../src'
import { describe, expect, it } from 'vitest'
import { createNode, createNodeTypeRegistry, findPort, getPortPosition, portAllows } from '../src'

const base = { size: { width: 120, height: 40 } } as const

describe('createNodeTypeRegistry', () => {
  it('按登记顺序列出类型并按名查找', () => {
    const registry = createNodeTypeRegistry([
      { ...base, type: 'b', ports: 'none' },
      { ...base, type: 'a', ports: 'none' },
    ])
    expect(registry.types.map(type => type.type)).toEqual(['b', 'a'])
    expect(registry.get('a')?.type).toBe('a')
    expect(registry.get('c')).toBeUndefined()
  })

  it('展开端口预设', () => {
    const registry = createNodeTypeRegistry([
      { ...base, type: 'in', ports: 'in' },
      { ...base, type: 'out', ports: 'out' },
      { ...base, type: 'both', ports: 'both' },
      { ...base, type: 'none', ports: 'none' },
    ])
    expect(registry.get('in')!.ports).toEqual([{ id: 'in', direction: 'in', side: 'left', offset: 0.5 }])
    expect(registry.get('out')!.ports).toEqual([{ id: 'out', direction: 'out', side: 'right', offset: 0.5 }])
    expect(registry.get('both')!.ports.map(port => port.id)).toEqual(['in', 'out'])
    expect(registry.get('none')!.ports).toEqual([])
  })

  it('具名端口补齐缺省 offset', () => {
    const registry = createNodeTypeRegistry([{
      ...base,
      type: 'gateway',
      ports: [
        { id: 'in', direction: 'in', side: 'top' },
        { id: 'yes', direction: 'out', side: 'bottom', offset: 0.25, label: '是', maxConnections: 1 },
        { id: 'io', direction: 'both', side: 'right', offset: 1 },
      ],
    }])
    expect(registry.get('gateway')!.ports).toEqual([
      { id: 'in', direction: 'in', side: 'top', offset: 0.5 },
      { id: 'yes', direction: 'out', side: 'bottom', offset: 0.25, label: '是', maxConnections: 1 },
      { id: 'io', direction: 'both', side: 'right', offset: 1 },
    ])
  })

  it.each<[string, FlowNodeTypeDefinition[], RegExp]>([
    ['重复类型', [{ ...base, type: 'a', ports: 'none' }, { ...base, type: 'a', ports: 'in' }], /registered more than once/],
    ['空类型名', [{ ...base, type: '', ports: 'none' }], /non-empty string/],
    ['负尺寸', [{ type: 'a', ports: 'none', size: { width: -1, height: 1 } }], /size/],
    ['未知预设', [{ ...base, type: 'a', ports: 'all' as 'both' }], /unknown port preset/],
    ['重复端口', [{ ...base, type: 'a', ports: [{ id: 'p', direction: 'in', side: 'left' }, { id: 'p', direction: 'out', side: 'right' }] }], /declared more than once/],
    ['未知方向', [{ ...base, type: 'a', ports: [{ id: 'p', direction: 'up' as 'in', side: 'left' }] }], /unknown direction/],
    ['未知边', [{ ...base, type: 'a', ports: [{ id: 'p', direction: 'in', side: 'center' as 'left' }] }], /unknown side/],
    ['offset 越界', [{ ...base, type: 'a', ports: [{ id: 'p', direction: 'in', side: 'left', offset: 1.5 }] }], /offset/],
    ['端口连接数非整数', [{ ...base, type: 'a', ports: [{ id: 'p', direction: 'in', side: 'left', maxConnections: 1.5 }] }], /maxConnections/],
    ['最大入度为负', [{ ...base, type: 'a', ports: 'in', connection: { maxIncoming: -1 } }], /maxIncoming/],
    ['个数上下限颠倒', [{ ...base, type: 'a', ports: 'in', minCount: 2, maxCount: 1 }], /minCount must not exceed/],
    ['默认 data 不是 JSON', [{ ...base, type: 'a', ports: 'in', defaults: { data: { v: Number.NaN } } }], /defaults.data/],
    ['属性路径为空', [{ ...base, type: 'a', ports: 'in', properties: [{ path: [], control: { kind: 'text' } }] }], /path must not be empty/],
    ['属性路径含原型段', [{ ...base, type: 'a', ports: 'in', properties: [{ path: ['data', '__proto__'], control: { kind: 'text' } }] }], /is invalid/],
    ['属性路径重复', [{ ...base, type: 'a', ports: 'in', properties: [{ path: ['a'], control: { kind: 'text' } }, { path: ['a'], control: { kind: 'json' } }] }], /declared more than once/],
  ])('定义不合法时抛错：%s', (_, definitions, message) => {
    expect(() => createNodeTypeRegistry(definitions)).toThrow(message)
  })
})

describe('createNode', () => {
  const registry = createNodeTypeRegistry([
    { type: 'task', size: { width: 160, height: 48 }, ports: 'both', defaults: { label: '任务', data: { retry: { max: 1 } } } },
    { type: 'bare', size: { width: 10, height: 10 }, ports: 'none' },
  ])

  it('按类型默认值新建，默认 data 深拷贝', () => {
    const task = registry.get('task')!
    const node = createNode(task, { id: 'n1', x: 5, y: 6 })
    expect(node).toEqual({ id: 'n1', type: 'task', x: 5, y: 6, width: 160, height: 48, label: '任务', data: { retry: { max: 1 } } })
    expect(node.data).not.toBe(task.defaults!.data)
    expect(node.data!.retry).not.toBe(task.defaults!.data!.retry)
  })

  it('init 中的字段优先', () => {
    const node = createNode(registry.get('task')!, { id: 'n1', x: 0, y: 0, width: 1, height: 2, label: '', data: {} })
    expect(node).toEqual({ id: 'n1', type: 'task', x: 0, y: 0, width: 1, height: 2, label: '', data: {} })
  })

  it('属性描述的缺省值写进还没有值的路径，已有的值不动', () => {
    const mail = createNodeTypeRegistry([{
      type: 'mail',
      size: { width: 10, height: 10 },
      ports: 'none',
      defaults: { data: { to: 'a' } },
      properties: [
        { path: ['data', 'to'], control: { kind: 'text' }, default: 'b' },
        { path: ['data', 'retry', 'max'], control: { kind: 'number' }, default: 3 },
        { path: ['label'], control: { kind: 'text' } },
      ],
    }]).get('mail')!
    expect(createNode(mail, { id: 'm', x: 0, y: 0 })).toEqual({ id: 'm', type: 'mail', x: 0, y: 0, width: 10, height: 10, data: { to: 'a', retry: { max: 3 } } })
  })

  it('类型无默认值时不写 label 与 data', () => {
    expect(createNode(registry.get('bare')!, { id: 'b', x: 1, y: 2 })).toEqual({ id: 'b', type: 'bare', x: 1, y: 2, width: 10, height: 10 })
  })
})

describe('端口工具', () => {
  const port = (side: FlowPort['side'], offset: number, direction: FlowPort['direction'] = 'both'): FlowPort => ({ id: 'p', direction, side, offset })
  const rect = { x: 100, y: 200, width: 40, height: 20 }

  it('计算端口位置', () => {
    expect(getPortPosition(rect, port('top', 0.25))).toEqual({ x: 110, y: 200 })
    expect(getPortPosition(rect, port('bottom', 1))).toEqual({ x: 140, y: 220 })
    expect(getPortPosition(rect, port('left', 0))).toEqual({ x: 100, y: 200 })
    expect(getPortPosition(rect, port('right', 0.5))).toEqual({ x: 140, y: 210 })
  })

  it('判断端口能否作为连线起点或终点', () => {
    expect(portAllows(port('left', 0.5, 'in'), 'target')).toBe(true)
    expect(portAllows(port('left', 0.5, 'in'), 'source')).toBe(false)
    expect(portAllows(port('left', 0.5, 'out'), 'source')).toBe(true)
    expect(portAllows(port('left', 0.5, 'out'), 'target')).toBe(false)
    expect(portAllows(port('left', 0.5, 'both'), 'source')).toBe(true)
    expect(portAllows(port('left', 0.5, 'both'), 'target')).toBe(true)
  })

  it('按 id 查找端口', () => {
    const registry = createNodeTypeRegistry([{ ...base, type: 't', ports: 'both' }])
    expect(findPort(registry.get('t')!, 'out')?.direction).toBe('out')
    expect(findPort(registry.get('t')!, 'x')).toBeUndefined()
  })
})
