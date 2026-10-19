/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

// 宿主先建 <xh-flow-designer> 并赋 schema 与 extensions，设计器模块后到才注册（按需加载）：
// 两个元素都在注册前建好并赋值，一个先插进文档（Vue 挂载顺序），一个注册后才插进去。

import type { XhFlowDesigner } from '../src'
import { beforeAll, describe, expect, it } from 'vitest'
import { defineFlowDesigner, FLOW_DESIGNER_TAG } from '../src'
import { nodes, part, sample } from './helpers'

const connectedFirst = window.document.createElement(FLOW_DESIGNER_TAG) as XhFlowDesigner
const appendedLater = window.document.createElement(FLOW_DESIGNER_TAG) as XhFlowDesigner
const schemas = { connectedFirst: sample(), appendedLater: sample() }

beforeAll(() => {
  for (const [designer, schema] of [[connectedFirst, schemas.connectedFirst], [appendedLater, schemas.appendedLater]] as const) {
    designer.extensions = [nodes]
    designer.schema = schema
  }
  window.document.body.append(connectedFirst)
  defineFlowDesigner()
})

function nodeIds(designer: XhFlowDesigner): string[] {
  return part(designer, 'node').map(node => node.dataset.nodeId!)
}

describe('先赋 schema、后注册', () => {
  it('已插进文档的元素在注册时升级，赋的 schema 与 extensions 经访问器生效', async () => {
    await connectedFirst.updateComplete

    expect(Object.hasOwn(connectedFirst, 'schema')).toBe(false)
    expect(Object.hasOwn(connectedFirst, 'extensions')).toBe(false)
    expect(connectedFirst.schema).toBe(schemas.connectedFirst)
    expect(connectedFirst.extensions).toEqual([nodes])
    expect(nodeIds(connectedFirst)).toEqual(['s', 't', 'e'])
  })

  it('注册后才插进文档的元素在连上时生效', async () => {
    window.document.body.append(appendedLater)
    await appendedLater.updateComplete

    expect(appendedLater.schema).toBe(schemas.appendedLater)
    expect(nodeIds(appendedLater)).toEqual(['s', 't', 'e'])
  })
})
