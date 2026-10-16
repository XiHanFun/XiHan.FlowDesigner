/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程的剪贴板数据：节点与两端都在其中的连线，经 designer-kit 的剪贴板包序列化成 JSON 文本。

import type { JsonValue } from '@xihan-ui/core/json'
import type { FlowClipboard } from './editor'
import { FLOW_DOCUMENT_VERSION, readDocument } from '@xihan-flow/core'
import { isPlainObject } from '@xihan-ui/core/json'
import { clipboardMimeType, decodeClipboard, encodeClipboard } from '@xihan-ui/designer-kit'

/** 剪贴板包上的产品名。 */
const PRODUCT = 'flow'
/** 载荷的结构版本。 */
const VERSION = 1

/** 把剪贴板内容序列化成剪贴板包的 JSON 文本。 */
export function encodeFlowClipboard(clipboard: FlowClipboard): string {
  return encodeClipboard(PRODUCT, VERSION, { nodes: clipboard.nodes, edges: clipboard.edges } as unknown as JsonValue)
}

/**
 * 解析剪贴板文本：不是流程的剪贴板包、版本不认得、节点或连线的结构不合法、id 重复时返回 undefined。
 * 两端不都在其中的连线照样读出，粘贴时丢弃。
 */
export function decodeFlowClipboard(text: string): FlowClipboard | undefined {
  const decoded = decodeClipboard(text, PRODUCT)
  if (!decoded.ok || decoded.version !== VERSION || !isPlainObject(decoded.payload))
    return undefined
  const { nodes, edges } = decoded.payload
  const read = readDocument({ version: FLOW_DOCUMENT_VERSION, nodes, edges })
  if (!read.ok || hasDuplicateIds(read.document.nodes) || hasDuplicateIds(read.document.edges))
    return undefined
  return { nodes: read.document.nodes, edges: read.document.edges }
}

/** 把剪贴板内容写进剪贴板事件的数据：流程自己的类型一份，text/plain 一份。 */
export function writeFlowClipboard(data: DataTransfer, clipboard: FlowClipboard): void {
  const text = encodeFlowClipboard(clipboard)
  data.setData(clipboardMimeType(PRODUCT), text)
  data.setData('text/plain', text)
}

/** 从剪贴板事件的数据里读出流程的剪贴板内容：先取流程自己的类型，没有再取 text/plain。 */
export function readFlowClipboard(data: DataTransfer): FlowClipboard | undefined {
  const text = data.getData(clipboardMimeType(PRODUCT)) || data.getData('text/plain')
  return text === '' ? undefined : decodeFlowClipboard(text)
}

function hasDuplicateIds(items: readonly { readonly id: string }[]): boolean {
  return new Set(items.map(item => item.id)).size !== items.length
}
