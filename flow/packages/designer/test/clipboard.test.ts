/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowClipboard } from '../src'
import { encodeClipboard } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { decodeFlowClipboard, encodeFlowClipboard } from '../src'

const clipboard: FlowClipboard = {
  nodes: [
    { id: 'a', type: 'task', x: 0, y: 0, width: 100, height: 40, data: { owner: 'u1' } },
    { id: 'b', type: 'task', x: 200, y: 0, width: 100, height: 40 },
  ],
  edges: [{ id: 'ab', source: { node: 'a' }, target: { node: 'b' }, vertices: [{ x: 150, y: 60 }] }],
}

describe('流程剪贴板', () => {
  it('序列化成剪贴板包，解析回同样的内容', () => {
    const text = encodeFlowClipboard(clipboard)
    expect(JSON.parse(text)).toMatchObject({ format: 'xihan-designer-clipboard', product: 'flow', version: 1 })
    expect(decodeFlowClipboard(text)).toEqual(clipboard)
  })

  it('不是流程的剪贴板包或版本不认得时返回 undefined', () => {
    expect(decodeFlowClipboard('not json')).toBeUndefined()
    expect(decodeFlowClipboard('{"nodes":[]}')).toBeUndefined()
    expect(decodeFlowClipboard(encodeClipboard('print', 1, { nodes: [], edges: [] }))).toBeUndefined()
    expect(decodeFlowClipboard(encodeClipboard('flow', 2, { nodes: [], edges: [] }))).toBeUndefined()
    expect(decodeFlowClipboard(encodeClipboard('flow', 1, []))).toBeUndefined()
  })

  it('节点或连线的结构不合法、id 重复时返回 undefined', () => {
    expect(decodeFlowClipboard(encodeClipboard('flow', 1, { nodes: [{ id: 'a', type: 'task' }], edges: [] }))).toBeUndefined()
    expect(decodeFlowClipboard(encodeClipboard('flow', 1, { nodes: [] }))).toBeUndefined()
    const duplicated = { nodes: [clipboard.nodes[0]!, clipboard.nodes[0]!], edges: [] }
    expect(decodeFlowClipboard(encodeFlowClipboard(duplicated))).toBeUndefined()
  })
})
