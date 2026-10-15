/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject, JsonPrimitive, JsonValue } from './json'
import { isPlainObject, jsonEquals } from './json'

/** 节点 data 内的路径，逐级为对象键。 */
export type FlowDataPath = readonly string[]

/** 属性选项。 */
export interface FlowPropertyOption {
  readonly value: JsonPrimitive
  readonly label?: string
  readonly meta?: JsonObject
}

/** 属性显示条件：按 data 中其它路径的取值判断，可用 all / any / not 组合。 */
export type FlowPropertyCondition
  = | { readonly path: FlowDataPath, readonly equals: JsonValue }
    | { readonly path: FlowDataPath, readonly oneOf: readonly JsonValue[] }
    | { readonly path: FlowDataPath, readonly filled: boolean }
    | { readonly all: readonly FlowPropertyCondition[] }
    | { readonly any: readonly FlowPropertyCondition[] }
    | { readonly not: FlowPropertyCondition }

/** 属性描述：驱动属性面板的一项。 */
export interface FlowPropertyDescriptor {
  /** 值在节点 data 中的路径。 */
  readonly path: FlowDataPath
  /** 编辑器种类，由使用方解释（如 text、select、json）。 */
  readonly editor: string
  readonly label?: string
  /** 所属分组。 */
  readonly group?: string
  readonly options?: readonly FlowPropertyOption[]
  /** 值缺省时生效的取值。 */
  readonly defaultValue?: JsonValue
  /** 显示时必须填写。 */
  readonly required?: boolean
  /** 显示条件；缺省时总是显示。 */
  readonly visibleWhen?: FlowPropertyCondition
  readonly meta?: JsonObject
}

/** 一组属性。 */
export interface FlowPropertyGroup {
  readonly group: string | undefined
  readonly properties: readonly FlowPropertyDescriptor[]
}

/** 读取 data 中路径处的值；路径中途不是对象时返回 undefined。 */
export function getDataValue(data: JsonObject | undefined, path: FlowDataPath): JsonValue | undefined {
  let current: JsonValue | undefined = data
  for (const key of path) {
    if (!isPlainObject(current) || !Object.hasOwn(current, key))
      return undefined
    current = (current as JsonObject)[key]
  }
  return current
}

/**
 * 返回在路径处写入值后的新 data，不修改原对象；value 为 undefined 时删除该键。
 * 缺失的中间层按空对象补齐，中间层存在但不是对象时抛错。
 */
export function setDataValue(data: JsonObject | undefined, path: FlowDataPath, value: JsonValue | undefined): JsonObject {
  if (path.length === 0)
    throw new Error('[flow-core] setDataValue requires a non-empty path')
  return writeAt(data ?? {}, path, 0, value)
}

function writeAt(target: JsonObject, path: FlowDataPath, depth: number, value: JsonValue | undefined): JsonObject {
  const key = path[depth]!
  const copy: Record<string, JsonValue> = { ...target }
  if (depth === path.length - 1) {
    if (value === undefined)
      delete copy[key]
    else
      copy[key] = value
    return copy
  }
  const child = Object.hasOwn(target, key) ? target[key] : undefined
  if (child !== undefined && !isPlainObject(child))
    throw new Error(`[flow-core] cannot write through non-object at "${path.slice(0, depth + 1).join('.')}"`)
  copy[key] = writeAt((child as JsonObject | undefined) ?? {}, path, depth + 1, value)
  return copy
}

/** 判断值是否已填写：undefined、null、空串、空数组与空对象视为未填写。 */
export function isFilled(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null || value === '')
    return false
  if (Array.isArray(value))
    return value.length > 0
  if (isPlainObject(value))
    return Object.keys(value).length > 0
  return true
}

/** 按 data 求值显示条件。 */
export function evaluateCondition(condition: FlowPropertyCondition, data: JsonObject | undefined): boolean {
  if ('all' in condition)
    return condition.all.every(item => evaluateCondition(item, data))
  if ('any' in condition)
    return condition.any.some(item => evaluateCondition(item, data))
  if ('not' in condition)
    return !evaluateCondition(condition.not, data)
  const value = getDataValue(data, condition.path)
  if ('equals' in condition)
    return jsonEquals(value, condition.equals)
  if ('oneOf' in condition)
    return condition.oneOf.some(candidate => jsonEquals(value, candidate))
  return isFilled(value) === condition.filled
}

/** 判断属性在当前 data 下是否显示。 */
export function isPropertyVisible(descriptor: FlowPropertyDescriptor, data: JsonObject | undefined): boolean {
  return descriptor.visibleWhen === undefined || evaluateCondition(descriptor.visibleWhen, data)
}

/**
 * 把当前显示的属性按分组排列：order 中列出的分组在前并按其顺序，
 * 其余分组按首次出现顺序，无分组的属性排最后；组内保持描述顺序，空组不出现。
 */
export function groupProperties(
  descriptors: readonly FlowPropertyDescriptor[],
  data: JsonObject | undefined,
  order: readonly string[] = [],
): FlowPropertyGroup[] {
  const buckets = new Map<string | undefined, FlowPropertyDescriptor[]>()
  for (const descriptor of descriptors) {
    if (!isPropertyVisible(descriptor, data))
      continue
    const bucket = buckets.get(descriptor.group)
    if (bucket)
      bucket.push(descriptor)
    else
      buckets.set(descriptor.group, [descriptor])
  }
  const named = [...buckets.keys()].filter((group): group is string => group !== undefined)
  const ordered = [
    ...order.filter(group => buckets.has(group)),
    ...named.filter(group => !order.includes(group)),
  ]
  const result: FlowPropertyGroup[] = ordered.map(group => ({ group, properties: buckets.get(group)! }))
  const ungrouped = buckets.get(undefined)
  if (ungrouped)
    result.push({ group: undefined, properties: ungrouped })
  return result
}
