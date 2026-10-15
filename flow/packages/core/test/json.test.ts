/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '../src'
import { describe, expect, it } from 'vitest'
import { cloneJson, findJsonViolation, isJsonValue, isPlainObject, jsonEquals } from '../src'

describe('isPlainObject', () => {
  it('只接受原型为 Object.prototype 或 null 的对象', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(new Map())).toBe(false)
  })
})

describe('findJsonViolation', () => {
  it('合法 JSON 返回 undefined', () => {
    expect(findJsonViolation({ a: [1, 'x', true, null, { b: -0.5 }] })).toBeUndefined()
    expect(isJsonValue('text')).toBe(true)
  })

  it('返回第一处非法值的 JSON Pointer', () => {
    expect(findJsonViolation({ a: [1, Number.NaN] })).toBe('/a/1')
    expect(findJsonViolation({ a: { b: undefined } })).toBe('/a/b')
    expect(findJsonViolation({ 'a/b': { '~c': () => 1 } })).toBe('/a~1b/~0c')
    expect(findJsonViolation({ when: new Date() })).toBe('/when')
    expect(findJsonViolation(Infinity, '/x')).toBe('/x')
  })

  it('循环引用视为非法', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(findJsonViolation(cyclic)).toBe('/self')
  })

  it('同一对象被多处引用不算循环', () => {
    const shared = { v: 1 }
    expect(findJsonViolation({ a: shared, b: [shared, shared] })).toBeUndefined()
  })
})

describe('cloneJson', () => {
  it('深拷贝且不共享引用', () => {
    const source: JsonObject = { a: { b: [1, { c: 2 }] } }
    const copy = cloneJson(source)
    expect(copy).toEqual(source)
    expect(copy).not.toBe(source)
    expect(copy.a).not.toBe(source.a)
  })
})

describe('jsonEquals', () => {
  it('对象比较与键顺序无关', () => {
    expect(jsonEquals({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
  })

  it('区分数组与对象、长度与缺失键', () => {
    expect(jsonEquals([1], { 0: 1 })).toBe(false)
    expect(jsonEquals([1, 2], [1])).toBe(false)
    expect(jsonEquals({ a: 1 }, { b: 1 })).toBe(false)
    expect(jsonEquals(null, {})).toBe(false)
    expect(jsonEquals(undefined, undefined)).toBe(true)
    expect(jsonEquals(1, '1')).toBe(false)
  })
})
