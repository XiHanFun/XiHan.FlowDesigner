/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '@xihan-ui/core/json'
import type { FlowPropertyDescriptor } from '../src'
import { describe, expect, it } from 'vitest'
import { evaluateCondition, groupProperties, isFilled, isPropertyVisible } from '../src'

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
