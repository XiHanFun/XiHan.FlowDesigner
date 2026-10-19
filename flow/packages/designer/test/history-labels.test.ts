/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowOperation } from '@xihan-flow/core'
import type { HistoryLabel } from '@xihan-ui/designer-kit'
import type { FlowHistoryLabelSource } from '../src/history-labels'
import { createFlowModel } from '@xihan-flow/core'
import { DEFAULT_FLOW_DESIGNER_TRANSLATIONS } from '@xihan-flow/runtime'
import { describe, expect, it } from 'vitest'
import { describeFlowOperations } from '../src/history-labels'
import { nodes, sample } from './helpers'

const source: FlowHistoryLabelSource = {
  translations: () => DEFAULT_FLOW_DESIGNER_TRANSLATIONS,
  model: () => createFlowModel([nodes]),
}

function text(label: HistoryLabel | undefined): string | undefined {
  return typeof label === 'function' ? label() : label
}

function describeOps(operations: readonly FlowOperation[], before: FlowDocument = sample()): string | undefined {
  return text(describeFlowOperations(operations, before, source))
}

describe('describeFlowOperations', () => {
  it('节点：一个写「种类 名称」（没有名称时是 id），几个写个数；增、删、移、改尺寸、改属性各一句', () => {
    const named: FlowDocument = { ...sample(), nodes: sample().nodes.map(node => node.id === 't' ? { ...node, label: '经理审批' } : node) }
    expect([
      describeOps([{ type: 'addNode', node: { id: 'n', type: 'task', x: 0, y: 0, width: 1, height: 1 } }]),
      describeOps([{ type: 'removeNode', id: 't' }], named),
      describeOps([{ type: 'removeNode', id: 't' }, { type: 'removeNode', id: 's' }]),
      describeOps([{ type: 'moveNodes', positions: [{ id: 's', x: 1, y: 1 }] }]),
      describeOps([{ type: 'moveNodes', positions: [{ id: 's', x: 1, y: 1 }, { id: 't', x: 2, y: 2 }] }]),
      describeOps([{ type: 'resizeNode', id: 'e', x: 0, y: 0, width: 9, height: 9 }]),
      describeOps([{ type: 'updateNode', id: 't', patch: { label: 'x' } }], named),
    ]).toEqual(['Add 任务 n', 'Delete 任务 经理审批', 'Delete 2 nodes', 'Move 开始 s', 'Move 2 nodes', 'Resize 结束 e', 'Edit 任务 经理审批'])
  })

  it('删掉节点的一步按节点说，连带删的连线不另说；粘贴出的节点与连线按节点说', () => {
    expect(describeOps([{ type: 'removeEdge', id: 'st' }, { type: 'removeNode', id: 's' }])).toBe('Delete 开始 s')
    expect(describeOps([
      { type: 'addNode', node: { id: 'a', type: 'task', x: 0, y: 0, width: 1, height: 1 } },
      { type: 'addNode', node: { id: 'b', type: 'task', x: 0, y: 0, width: 1, height: 1 } },
      { type: 'addEdge', edge: { id: 'ab', source: { node: 'a' }, target: { node: 'b' } } },
    ])).toBe('Add 2 nodes')
  })

  it('连线：增删一条与几条、改连、改属性；只动拐点时分清清除拐点与调整走向', () => {
    expect([
      describeOps([{ type: 'addEdge', edge: { id: 'x', source: { node: 's' }, target: { node: 'e' } } }]),
      describeOps([{ type: 'removeEdge', id: 'st' }]),
      describeOps([{ type: 'reconnectEdge', id: 'st', target: { node: 'e' } }]),
      describeOps([{ type: 'updateEdge', id: 'st', patch: { label: 'go' } }]),
      describeOps([{ type: 'updateEdge', id: 'st', patch: { vertices: null } }]),
      describeOps([{ type: 'updateEdge', id: 'st', patch: { vertices: [{ x: 1, y: 2 }] } }]),
    ]).toEqual(['Add connection', 'Delete connection', 'Reconnect connection', 'Edit connection', 'Reset route', 'Change connection route'])
  })

  it('流程定义的属性与整份替换各一句；空操作没有说明', () => {
    expect([
      describeOps([{ type: 'updateDocument', patch: { data: { a: 1 } } }]),
      describeOps([{ type: 'replaceDocument', document: { version: 1, nodes: [], edges: [] } }]),
      describeOps([]),
    ]).toEqual(['Edit flow properties', 'Edit JSON', undefined])
  })
})
