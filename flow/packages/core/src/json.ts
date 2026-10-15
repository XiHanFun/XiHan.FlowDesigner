/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

/** JSON 原始值。 */
export type JsonPrimitive = string | number | boolean | null

/** JSON 数组。 */
export type JsonArray = readonly JsonValue[]

/** JSON 对象。 */
export interface JsonObject {
  readonly [key: string]: JsonValue
}

/** 任意 JSON 值。 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject

/** 判断是否为原型为 Object.prototype 或 null 的普通对象。 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/** 把一个键编码为 JSON Pointer 片段。 */
export function encodePointerToken(token: string | number): string {
  return String(token).replace(/~/g, '~0').replace(/\//g, '~1')
}

/** 在 JSON Pointer 后追加一个片段。 */
export function appendPointer(pointer: string, token: string | number): string {
  return `${pointer}/${encodePointerToken(token)}`
}

/**
 * 查找值中第一处不是 JSON 的位置，返回其 JSON Pointer；整体合法时返回 undefined。
 * 非有限数字、undefined、函数、非普通对象与循环引用都视为非法。
 */
export function findJsonViolation(value: unknown, pointer = ''): string | undefined {
  return visitJson(value, pointer, new Set())
}

function visitJson(value: unknown, pointer: string, ancestors: Set<object>): string | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return undefined
  if (typeof value === 'number')
    return Number.isFinite(value) ? undefined : pointer
  if (Array.isArray(value)) {
    if (ancestors.has(value))
      return pointer
    ancestors.add(value)
    for (let index = 0; index < value.length; index++) {
      const found = visitJson(value[index], appendPointer(pointer, index), ancestors)
      if (found !== undefined)
        return found
    }
    ancestors.delete(value)
    return undefined
  }
  if (isPlainObject(value)) {
    if (ancestors.has(value))
      return pointer
    ancestors.add(value)
    for (const key of Object.keys(value)) {
      const found = visitJson(value[key], appendPointer(pointer, key), ancestors)
      if (found !== undefined)
        return found
    }
    ancestors.delete(value)
    return undefined
  }
  return pointer
}

/** 判断值是否为合法 JSON。 */
export function isJsonValue(value: unknown): value is JsonValue {
  return findJsonViolation(value) === undefined
}

/** 深拷贝 JSON 值。 */
export function cloneJson<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object')
    return value
  if (Array.isArray(value))
    return value.map(item => cloneJson(item)) as unknown as T
  const result: Record<string, JsonValue> = {}
  for (const key of Object.keys(value))
    result[key] = cloneJson((value as JsonObject)[key] as JsonValue)
  return result as T
}

/** 按值比较两个 JSON 值；对象比较与键顺序无关。 */
export function jsonEquals(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === b)
    return true
  if (a === undefined || b === undefined || a === null || b === null)
    return false
  if (typeof a !== 'object' || typeof b !== 'object')
    return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false
    return a.every((item, index) => jsonEquals(item, b[index]))
  }
  const objectA = a as JsonObject
  const objectB = b as JsonObject
  const keysA = Object.keys(objectA)
  if (keysA.length !== Object.keys(objectB).length)
    return false
  return keysA.every(key => Object.hasOwn(objectB, key) && jsonEquals(objectA[key], objectB[key]))
}
