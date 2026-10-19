/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 撤销历史里一步的说明：按这一步的正向操作与应用前的文档给出，文案在显示时现取、换语言跟着变，
// 节点的种类与名称在这一步执行时取好。单个节点写「种类 名称」，几个节点写个数；连线写条数。

import type { FlowDocument, FlowModel, FlowNode, FlowOperation } from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowHistoryTranslations } from '@xihan-flow/runtime'
import type { HistoryLabel } from '@xihan-ui/designer-kit'

/** 生成说明要用到的：现取的文案与流程模型（节点类型的显示名从这里取）。 */
export interface FlowHistoryLabelSource {
  readonly translations: () => FlowDesignerTranslations
  readonly model: () => FlowModel
}

/** 说明里的一个节点：类型与名称（没有名称时是 id）。 */
export interface FlowNodeIdentity {
  readonly type: string
  readonly name: string
}

/** 对一组节点做的事。 */
export type FlowNodePhrase = 'add' | 'remove' | 'edit' | 'move' | 'resize' | 'copy'

type CountKey = { [K in keyof FlowHistoryTranslations]: FlowHistoryTranslations[K] extends (count: number) => string ? K : never }[keyof FlowHistoryTranslations]
type LabelKey = { [K in keyof FlowHistoryTranslations]: FlowHistoryTranslations[K] extends (label: string) => string ? K : never }[keyof FlowHistoryTranslations]

const SINGLE: Readonly<Record<FlowNodePhrase, LabelKey>> = {
  add: 'addNode',
  remove: 'removeNode',
  edit: 'editNode',
  move: 'moveNode',
  resize: 'resizeNode',
  copy: 'copyNode',
}

const MANY: Readonly<Record<FlowNodePhrase, CountKey>> = {
  add: 'addNodes',
  remove: 'removeNodes',
  edit: 'editNodes',
  move: 'moveNodes',
  resize: 'resizeNodes',
  copy: 'copyNodes',
}

function identityOf(node: FlowNode | undefined, id: string): FlowNodeIdentity {
  return node === undefined ? { type: '', name: id } : { type: node.type, name: node.label ?? node.id }
}

/** 一组节点的说明：一个写「种类 名称」，几个写个数。 */
export function nodesLabel(phrase: FlowNodePhrase, nodes: readonly FlowNodeIdentity[], source: FlowHistoryLabelSource): HistoryLabel {
  return () => {
    const t = source.translations()
    if (nodes.length === 1) {
      const node = nodes[0]!
      const kind = node.type === '' ? '' : source.model().nodeTypes.get(node.type)?.label ?? node.type
      const label = kind === '' ? node.name : t.history.node(kind, node.name)
      return (t.history[SINGLE[phrase]] as (label: string) => string)(label)
    }
    return (t.history[MANY[phrase]] as (count: number) => string)(nodes.length)
  }
}

/** 文档里这些节点的种类与名称，同一个只算一次，取不到的写 id。 */
export function identitiesIn(document: FlowDocument, ids: readonly string[]): FlowNodeIdentity[] {
  return [...new Set(ids)].map(id => identityOf(document.nodes.find(node => node.id === id), id))
}

/** 一组连线的说明：一条写固定的一句，几条写条数。 */
function edgesLabel(single: 'addEdge' | 'removeEdge' | 'editEdge', many: 'addEdges' | 'removeEdges' | 'editEdges', count: number, source: FlowHistoryLabelSource): HistoryLabel {
  return () => {
    const history = source.translations().history
    return count === 1 ? history[single] : history[many](count)
  }
}

/**
 * 流程编辑器的 describe：按这一步的正向操作与应用前的文档给出说明。删了节点的一步按节点说（连带删掉的连线不另说），
 * 加了节点的按节点说（粘贴时连同连线）；只动连线拐点的分清是清除拐点还是调整走向。认不出的组合为 undefined。
 */
export function describeFlowOperations(operations: readonly FlowOperation[], before: FlowDocument, source: FlowHistoryLabelSource): HistoryLabel | undefined {
  const first = operations[0]
  if (first === undefined)
    return undefined
  const history = (pick: (t: FlowHistoryTranslations) => string): HistoryLabel => () => pick(source.translations().history)
  const ofType = <K extends FlowOperation['type']>(type: K): Extract<FlowOperation, { type: K }>[] =>
    operations.filter((operation): operation is Extract<FlowOperation, { type: K }> => operation.type === type)

  const removedNodes = ofType('removeNode').map(operation => operation.id)
  if (removedNodes.length > 0)
    return nodesLabel('remove', identitiesIn(before, removedNodes), source)
  const addedNodes = ofType('addNode')
  if (addedNodes.length > 0)
    return nodesLabel('add', addedNodes.map(operation => identityOf(operation.node, operation.node.id)), source)

  switch (first.type) {
    case 'addEdge':
      return edgesLabel('addEdge', 'addEdges', ofType('addEdge').length, source)
    case 'removeEdge':
      return edgesLabel('removeEdge', 'removeEdges', ofType('removeEdge').length, source)
    case 'moveNodes':
      return nodesLabel('move', identitiesIn(before, ofType('moveNodes').flatMap(operation => operation.positions.map(position => position.id))), source)
    case 'resizeNode':
      return nodesLabel('resize', identitiesIn(before, ofType('resizeNode').map(operation => operation.id)), source)
    case 'updateNode':
      return nodesLabel('edit', identitiesIn(before, ofType('updateNode').map(operation => operation.id)), source)
    case 'reconnectEdge':
      return history(t => t.reconnectEdge)
    case 'updateEdge': {
      const updates = ofType('updateEdge')
      if (updates.every(operation => Object.keys(operation.patch).every(key => key === 'vertices')))
        return updates.every(operation => operation.patch.vertices === null) ? () => source.translations().clearVertices : history(t => t.editRoute)
      return edgesLabel('editEdge', 'editEdges', new Set(updates.map(operation => operation.id)).size, source)
    }
    case 'updateDocument':
      return history(t => t.editDocument)
    case 'replaceDocument':
      return history(t => t.editJson)
  }
  return undefined
}
