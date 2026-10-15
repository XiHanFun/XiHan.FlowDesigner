/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '@xihan-ui/core/json'
import type { FlowPropertyDescriptor } from '../src'
import { describe, expect, it } from 'vitest'
import { evaluateCondition, getDataValue, groupProperties, isFilled, isPropertyVisible, setDataValue } from '../src'

describe('getDataValue', () => {
  const data: JsonObject = { properties: { Url: 'https://x', list: [1] }, flag: false }

  it('按路径读取', () => {
    expect(getDataValue(data, ['properties', 'Url'])).toBe('https://x')
    expect(getDataValue(data, ['flag'])).toBe(false)
    expect(getDataValue(data, [])).toBe(data)
  })

  it('路径不存在或中途不是对象时返回 undefined', () => {
    expect(getDataValue(data, ['properties', 'Method'])).toBeUndefined()
    expect(getDataValue(data, ['flag', 'x'])).toBeUndefined()
    expect(getDataValue(data, ['properties', 'list', '0'])).toBeUndefined()
    expect(getDataValue(undefined, ['a'])).toBeUndefined()
    expect(getDataValue({}, ['toString'])).toBeUndefined()
  })
})

describe('setDataValue', () => {
  it('返回新对象且不修改原对象，未改动的分支共享引用', () => {
    const data: JsonObject = { properties: { Url: 'a' }, other: { keep: true } }
    const next = setDataValue(data, ['properties', 'Method'], 'GET')
    expect(next).toEqual({ properties: { Url: 'a', Method: 'GET' }, other: { keep: true } })
    expect(data).toEqual({ properties: { Url: 'a' }, other: { keep: true } })
    expect(next.other).toBe(data.other)
  })

  it('补齐缺失的中间层', () => {
    expect(setDataValue(undefined, ['a', 'b', 'c'], 1)).toEqual({ a: { b: { c: 1 } } })
  })

  it('value 为 undefined 时删除键', () => {
    expect(setDataValue({ a: { b: 1, c: 2 } }, ['a', 'b'], undefined)).toEqual({ a: { c: 2 } })
  })

  it('中间层不是对象或路径为空时抛错', () => {
    expect(() => setDataValue({ a: [1] }, ['a', 'b'], 1)).toThrow(/non-object at "a"/)
    expect(() => setDataValue({}, [], 1)).toThrow(/non-empty path/)
  })
})

describe('isFilled', () => {
  it('空值判定', () => {
    for (const empty of [undefined, null, '', [], {}])
      expect(isFilled(empty)).toBe(false)
    for (const filled of [0, false, 'x', [0], { a: null }])
      expect(isFilled(filled)).toBe(true)
  })
})

describe('evaluateCondition', () => {
  const data: JsonObject = { mode: 'Fallback', count: 2, rules: [], nested: { tags: ['a'] } }

  it('equals 按值比较', () => {
    expect(evaluateCondition({ path: ['mode'], equals: 'Fallback' }, data)).toBe(true)
    expect(evaluateCondition({ path: ['nested'], equals: { tags: ['a'] } }, data)).toBe(true)
    expect(evaluateCondition({ path: ['count'], equals: '2' }, data)).toBe(false)
  })

  it('oneOf 与 filled', () => {
    expect(evaluateCondition({ path: ['count'], oneOf: [1, 2] }, data)).toBe(true)
    expect(evaluateCondition({ path: ['rules'], filled: true }, data)).toBe(false)
    expect(evaluateCondition({ path: ['missing'], filled: false }, data)).toBe(true)
  })

  it('all / any / not 组合', () => {
    expect(evaluateCondition({ all: [{ path: ['mode'], equals: 'Fallback' }, { path: ['count'], equals: 2 }] }, data)).toBe(true)
    expect(evaluateCondition({ all: [{ path: ['mode'], equals: 'Fallback' }, { path: ['count'], equals: 3 }] }, data)).toBe(false)
    expect(evaluateCondition({ any: [{ path: ['mode'], equals: 'x' }, { path: ['nested', 'tags'], filled: true }] }, data)).toBe(true)
    expect(evaluateCondition({ not: { path: ['mode'], equals: 'Fallback' } }, data)).toBe(false)
    expect(evaluateCondition({ all: [] }, data)).toBe(true)
    expect(evaluateCondition({ any: [] }, data)).toBe(false)
  })
})

describe('isPropertyVisible / groupProperties', () => {
  const fallback: FlowPropertyDescriptor = {
    path: ['fallback'],
    editor: 'assignees',
    group: 'participants',
    visibleWhen: { any: [{ path: ['strategy'], equals: 'Fallback' }, { path: ['fallback'], filled: true }] },
  }
  const descriptors: FlowPropertyDescriptor[] = [
    { path: ['title'], editor: 'text', group: 'basic' },
    { path: ['note'], editor: 'textarea' },
    { path: ['form'], editor: 'json', group: 'form' },
    { path: ['strategy'], editor: 'select', group: 'participants' },
    fallback,
    { path: ['extra'], editor: 'text', group: 'advanced' },
  ]

  it('条件不满足时隐藏，已填值时照样显示', () => {
    expect(isPropertyVisible(fallback, { strategy: 'Fault' })).toBe(false)
    expect(isPropertyVisible(fallback, { strategy: 'Fallback' })).toBe(true)
    expect(isPropertyVisible(fallback, { strategy: 'Fault', fallback: [{ kind: 'user' }] })).toBe(true)
  })

  it('按给定顺序分组，未列出的分组按出现顺序，无分组排最后', () => {
    const groups = groupProperties(descriptors, { strategy: 'Fallback' }, ['participants', 'basic', 'missing'])
    expect(groups.map(group => [group.group, group.properties.map(item => item.path.join('.'))])).toEqual([
      ['participants', ['strategy', 'fallback']],
      ['basic', ['title']],
      ['form', ['form']],
      ['advanced', ['extra']],
      [undefined, ['note']],
    ])
  })

  it('隐藏属性不进分组，空组不出现', () => {
    const groups = groupProperties([fallback], {})
    expect(groups).toEqual([])
  })
})
