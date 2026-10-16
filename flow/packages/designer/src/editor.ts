/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type {
  FlowConnectionProblem,
  FlowDocument,
  FlowEdge,
  FlowEdgeEnd,
  FlowEdgePatch,
  FlowEdgeStyle,
  FlowEndpoint,
  FlowIssue,
  FlowNode,
  FlowNodePatch,
  FlowNodeTypeRegistry,
  FlowOperation,
  FlowValidateOptions,
} from '@xihan-flow/core'
import type { JsonObject, JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { AlignMode, DistributeAxis, ExecuteOptions, History, HistoryChangeKind, Point } from '@xihan-ui/designer-kit'
import type { LayeredDirection } from '@xihan-ui/viz/graph'
import { applyOperation, checkConnection, createNode, validateDocument } from '@xihan-flow/core'
import { formatJsonPath, getJsonAt, jsonEquals, setJsonAt } from '@xihan-ui/core/json'
import { alignRects, createHistory, distributeRects, nextFreeId, remapIds, unionRects } from '@xihan-ui/designer-kit'
import { layered } from '@xihan-ui/viz/graph'

/** 选中的节点与连线 id，各自按选中先后排列。 */
export interface FlowSelection {
  readonly nodes: readonly string[]
  readonly edges: readonly string[]
}

/** 选择方式：替换、追加或切换。 */
export type FlowSelectMode = 'replace' | 'add' | 'toggle'

/** 剪贴板内容：被复制的节点及两端都在其中的连线。 */
export interface FlowClipboard {
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
}

/** 被写入属性的对象：节点或连线。 */
export interface FlowPropertyRef {
  readonly kind: 'node' | 'edge'
  readonly id: string
}

/** 编辑器变化：文档变化带上历史变化的种类与实际应用的操作。 */
export type FlowEditorChange
  = | { readonly kind: 'document', readonly cause: HistoryChangeKind, readonly document: FlowDocument, readonly operations: readonly FlowOperation[] }
    | { readonly kind: 'selection', readonly selection: FlowSelection }

/** 生成新节点或新连线的 id；必须在文档内唯一。 */
export type FlowIdFactory = (kind: 'node' | 'edge', nodeType?: string) => string

export interface FlowEditorOptions {
  readonly document: FlowDocument
  readonly registry: FlowNodeTypeRegistry
  /** 缺省时节点取 `${type}_${n}`，连线取 `edge_${n}`，n 为文档内同前缀的最大序号加一。 */
  readonly createId?: FlowIdFactory
  /** 撤销步数上限，缺省 100。 */
  readonly historyLimit?: number
  /** 同一合并键相隔多少毫秒内并入上一步，缺省 1000。 */
  readonly mergeWithin?: number
  readonly now?: () => number
}

/** 新建节点的参数：位置为左上角。 */
export interface FlowAddNodeInit {
  readonly x: number
  readonly y: number
  readonly label?: string
  readonly data?: JsonObject
}

/** 连接结果：成功时给出新连线，被约束拒绝时给出全部问题。 */
export type FlowConnectResult
  = | { readonly ok: true, readonly edge: FlowEdge }
    | { readonly ok: false, readonly problems: readonly FlowConnectionProblem[] }

/** 自动布局选项。 */
export interface FlowAutoLayoutOptions {
  readonly direction?: LayeredDirection
  readonly nodeGap?: number
  readonly layerGap?: number
  readonly label?: string
}

export interface FlowEditor {
  readonly document: FlowDocument
  readonly registry: FlowNodeTypeRegistry
  readonly history: History<FlowDocument, FlowOperation>
  readonly selection: FlowSelection
  /** 换用新的节点类型登记表，文档与历史不变。 */
  readonly setRegistry: (registry: FlowNodeTypeRegistry) => void
  /** 装载新文档：清空历史与选择。 */
  readonly load: (document: FlowDocument) => void
  /** 执行一组操作并记为一步撤销；返回新文档。 */
  readonly execute: (operations: readonly FlowOperation[], options?: ExecuteOptions) => FlowDocument
  readonly undo: () => boolean
  readonly redo: () => boolean
  /** 封口：此后带同一合并键的修改另起一步。 */
  readonly seal: () => void
  readonly select: (selection: Partial<FlowSelection>, mode?: FlowSelectMode) => void
  readonly selectAll: () => void
  readonly clearSelection: () => void
  /** 按节点类型新建节点并选中它；类型未登记时抛错。 */
  readonly addNode: (type: string, init: FlowAddNodeInit, options?: ExecuteOptions) => FlowNode
  /** 检查在两端点间新增连线会违反的约束；空数组表示可以连接。 */
  readonly checkConnect: (source: FlowEndpoint, target: FlowEndpoint, ignoreEdge?: string) => FlowConnectionProblem[]
  /** 在两端点间新增连线并选中它；违反约束时不改文档。 */
  readonly connect: (source: FlowEndpoint, target: FlowEndpoint, options?: ExecuteOptions) => FlowConnectResult
  /** 把连线的一端改连到新端点；违反约束时不改文档。 */
  readonly reconnect: (edgeId: string, end: FlowEdgeEnd, endpoint: FlowEndpoint, options?: ExecuteOptions) => FlowConnectResult
  /** 删除选中的节点（连带相连的连线）与连线；没有选中时返回 false。 */
  readonly deleteSelection: (options?: ExecuteOptions) => boolean
  /** 平移一组节点；位移为零或节点为空时什么都不做。 */
  readonly moveNodes: (ids: readonly string[], dx: number, dy: number, options?: ExecuteOptions) => void
  readonly updateNode: (id: string, patch: FlowNodePatch, options?: ExecuteOptions) => void
  readonly updateEdge: (id: string, patch: FlowEdgePatch, options?: ExecuteOptions) => void
  /**
   * 写入节点属性：path 相对节点本身，与属性描述的 path 相同。['label'] 写标签，以 'data' 开头的写进 data，
   * 其余路径抛错；value 为 undefined 时删除。同一节点同一路径的连续写入不论停顿多久都合并为一步，seal() 后另起一步。
   */
  readonly setNodeProperty: (id: string, path: JsonPath, value: JsonValue | undefined, options?: ExecuteOptions) => void
  /**
   * 写入连线属性：path 相对连线本身。['label'] 写标签，以 'style' 或 'data' 开头的写进对应字段，
   * 其余路径抛错；value 为 undefined 时删除。同一连线同一路径的连续写入不论停顿多久都合并为一步，seal() 后另起一步。
   */
  readonly setEdgeProperty: (id: string, path: JsonPath, value: JsonValue | undefined, options?: ExecuteOptions) => void
  /**
   * 给一组节点与连线写入同一属性，记为一步，规则同 setNodeProperty / setEdgeProperty；值都没变时什么都不做。
   * 同一组对象同一路径的连续写入不论停顿多久都合并为一步，seal() 后另起一步。
   */
  readonly setProperty: (targets: readonly FlowPropertyRef[], path: JsonPath, value: JsonValue | undefined, options?: ExecuteOptions) => void
  /** 剪贴板里有内容，可以粘贴。 */
  readonly hasClipboard: boolean
  /** 复制选中的节点与两端都被选中的连线；没有选中节点时返回 undefined。 */
  readonly copy: () => FlowClipboard | undefined
  /** 复制选中内容后删除选中的节点与连线，删除记为一步；没有选中节点时什么都不做，返回 undefined。 */
  readonly cut: (options?: ExecuteOptions) => FlowClipboard | undefined
  /**
   * 粘贴剪贴板内容并选中粘贴出的对象，每次粘贴比上一次多偏移 offset。缺省用当前剪贴板内容；
   * 给了 clipboard 时它成为剪贴板内容，与当前内容相同则接着累加偏移。
   */
  readonly paste: (clipboard?: FlowClipboard, options?: ExecuteOptions & { readonly offset?: number }) => FlowSelection
  /** 复制选中内容并立即粘贴，不改动剪贴板。 */
  readonly duplicate: (options?: ExecuteOptions & { readonly offset?: number }) => FlowSelection
  /** 对齐选中的节点；少于两个时什么都不做。 */
  readonly align: (mode: AlignMode, options?: ExecuteOptions) => void
  /** 等距分布选中的节点；少于三个时什么都不做。 */
  readonly distribute: (axis: DistributeAxis, options?: ExecuteOptions) => void
  /** 按连线方向分层排布全部节点，左上角保持在原包围盒的左上角，并清除连线的手动拐点。 */
  readonly autoLayout: (options?: FlowAutoLayoutOptions) => void
  readonly validate: (options?: FlowValidateOptions) => FlowIssue[]
  readonly subscribe: (listener: (change: FlowEditorChange) => void) => () => void
}

const EMPTY_SELECTION: FlowSelection = { nodes: [], edges: [] }
const DEFAULT_PASTE_OFFSET = 24

/** 创建流程编辑器：在历史栈之上维护选择、剪贴板与编辑命令。 */
export function createFlowEditor(options: FlowEditorOptions): FlowEditor {
  let registry = options.registry
  let selection = EMPTY_SELECTION
  let clipboard: FlowClipboard | undefined
  let pasteCount = 0
  const listeners = new Set<(change: FlowEditorChange) => void>()
  const history = createHistory<FlowDocument, FlowOperation>({
    document: options.document,
    apply: applyOperation,
    limit: options.historyLimit,
    mergeWithin: options.mergeWithin ?? 1000,
    now: options.now,
  })

  const emit = (change: FlowEditorChange): void => {
    for (const listener of Array.from(listeners))
      listener(change)
  }

  const setSelection = (next: FlowSelection): void => {
    if (sameIds(next.nodes, selection.nodes) && sameIds(next.edges, selection.edges))
      return
    selection = next
    emit({ kind: 'selection', selection })
  }

  history.subscribe((change) => {
    emit({ kind: 'document', cause: change.kind, document: change.document, operations: change.operations })
    const nodeIds = new Set(change.document.nodes.map(node => node.id))
    const edgeIds = new Set(change.document.edges.map(edge => edge.id))
    setSelection({
      nodes: selection.nodes.filter(id => nodeIds.has(id)),
      edges: selection.edges.filter(id => edgeIds.has(id)),
    })
  })

  const document = (): FlowDocument => history.document

  /** 分配 id；batch 收集同一批已分配的 id，缺省生成时一并避开。 */
  const allocate = (kind: 'node' | 'edge', nodeType?: string, batch: Set<string> = new Set()): string => {
    let id: string
    if (options.createId) {
      id = options.createId(kind, nodeType)
    }
    else {
      const current = document()
      const existing = kind === 'node' ? current.nodes.map(node => node.id) : current.edges.map(edge => edge.id)
      id = nextFreeId(kind === 'node' ? `${nodeType}_` : 'edge_', [...existing, ...batch])
    }
    batch.add(id)
    return id
  }

  const nodeById = (id: string): FlowNode | undefined => document().nodes.find(node => node.id === id)

  const selectedNodes = (): FlowNode[] => {
    const ids = new Set(selection.nodes)
    return document().nodes.filter(node => ids.has(node.id))
  }

  const moveTo = (nodes: readonly FlowNode[], positions: readonly Point[], executeOptions?: ExecuteOptions): void => {
    history.execute([{
      type: 'moveNodes',
      positions: nodes.map((node, index) => ({ id: node.id, x: positions[index]!.x, y: positions[index]!.y })),
    }], executeOptions)
  }

  const pasteInto = (source: FlowClipboard, offset: number, executeOptions: ExecuteOptions | undefined): FlowSelection => {
    if (source.nodes.length === 0)
      return EMPTY_SELECTION
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()
    const types = new Map(source.nodes.map(node => [node.id, node.type]))
    const remap = remapIds(types.keys(), id => allocate('node', types.get(id), nodeIds))
    const nodes = source.nodes.map((node): FlowNode => ({ ...node, id: remap.get(node.id)!, x: node.x + offset, y: node.y + offset }))
    const kept = source.edges.filter(edge => remap.has(edge.source.node) && remap.has(edge.target.node))
    const edgeRemap = remapIds(kept.map(edge => edge.id), () => allocate('edge', undefined, edgeIds))
    const edges = kept
      .map((edge): FlowEdge => ({
        ...edge,
        id: edgeRemap.get(edge.id)!,
        source: { ...edge.source, node: remap.get(edge.source.node)! },
        target: { ...edge.target, node: remap.get(edge.target.node)! },
        ...(edge.vertices === undefined ? {} : { vertices: edge.vertices.map(point => ({ x: point.x + offset, y: point.y + offset })) }),
      }))
    history.execute([
      ...nodes.map((node): FlowOperation => ({ type: 'addNode', node })),
      ...edges.map((edge): FlowOperation => ({ type: 'addEdge', edge })),
    ], executeOptions)
    const pasted = { nodes: nodes.map(node => node.id), edges: edges.map(edge => edge.id) }
    setSelection(pasted)
    return pasted
  }

  const snapshot = (): FlowClipboard | undefined => {
    const nodes = selectedNodes()
    if (nodes.length === 0)
      return undefined
    const ids = new Set(nodes.map(node => node.id))
    return { nodes, edges: document().edges.filter(edge => ids.has(edge.source.node) && ids.has(edge.target.node)) }
  }

  const editor: FlowEditor = {
    get document() {
      return document()
    },
    get registry() {
      return registry
    },
    history,
    get selection() {
      return selection
    },
    get hasClipboard() {
      return clipboard !== undefined
    },

    setRegistry(next) {
      registry = next
    },

    load(next) {
      setSelection(EMPTY_SELECTION)
      history.reset(next)
    },

    execute: (operations, executeOptions) => history.execute(operations, executeOptions),
    undo: () => history.undo(),
    redo: () => history.redo(),
    seal: () => history.seal(),

    select(next, mode = 'replace') {
      const nodes = next.nodes ?? []
      const edges = next.edges ?? []
      if (mode === 'replace') {
        setSelection({ nodes: unique(nodes), edges: unique(edges) })
        return
      }
      if (mode === 'add') {
        setSelection({ nodes: unique([...selection.nodes, ...nodes]), edges: unique([...selection.edges, ...edges]) })
        return
      }
      setSelection({ nodes: toggle(selection.nodes, nodes), edges: toggle(selection.edges, edges) })
    },

    selectAll() {
      setSelection({ nodes: document().nodes.map(node => node.id), edges: document().edges.map(edge => edge.id) })
    },

    clearSelection() {
      setSelection(EMPTY_SELECTION)
    },

    addNode(type, init, executeOptions) {
      const nodeType = registry.get(type)
      if (!nodeType)
        throw new Error(`[flow-designer] node type "${type}" is not registered`)
      const node = createNode(nodeType, { ...init, id: allocate('node', type) })
      history.execute([{ type: 'addNode', node }], executeOptions)
      setSelection({ nodes: [node.id], edges: [] })
      return node
    },

    checkConnect: (source, target, ignoreEdge) =>
      checkConnection(document(), registry, source, target, ignoreEdge === undefined ? {} : { ignoreEdge }),

    connect(source, target, executeOptions) {
      const problems = editor.checkConnect(source, target)
      if (problems.length > 0)
        return { ok: false, problems }
      const edge: FlowEdge = { id: allocate('edge'), source, target }
      history.execute([{ type: 'addEdge', edge }], executeOptions)
      setSelection({ nodes: [], edges: [edge.id] })
      return { ok: true, edge }
    },

    reconnect(edgeId, end, endpoint, executeOptions) {
      const edge = document().edges.find(item => item.id === edgeId)
      if (!edge)
        throw new Error(`[flow-designer] edge "${edgeId}" does not exist`)
      const source = end === 'source' ? endpoint : edge.source
      const target = end === 'target' ? endpoint : edge.target
      const problems = editor.checkConnect(source, target, edgeId)
      if (problems.length > 0)
        return { ok: false, problems }
      history.execute([end === 'source' ? { type: 'reconnectEdge', id: edgeId, source } : { type: 'reconnectEdge', id: edgeId, target }], executeOptions)
      return { ok: true, edge: document().edges.find(item => item.id === edgeId)! }
    },

    deleteSelection(executeOptions) {
      if (selection.nodes.length === 0 && selection.edges.length === 0)
        return false
      history.execute([
        ...selection.edges.map((id): FlowOperation => ({ type: 'removeEdge', id })),
        ...selection.nodes.map((id): FlowOperation => ({ type: 'removeNode', id })),
      ], executeOptions)
      return true
    },

    moveNodes(ids, dx, dy, executeOptions) {
      if (ids.length === 0 || (dx === 0 && dy === 0))
        return
      const positions = ids.map((id) => {
        const node = nodeById(id)
        if (!node)
          throw new Error(`[flow-designer] node "${id}" does not exist`)
        return { id, x: node.x + dx, y: node.y + dy }
      })
      history.execute([{ type: 'moveNodes', positions }], executeOptions)
    },

    updateNode: (id, patch, executeOptions) => {
      history.execute([{ type: 'updateNode', id, patch }], executeOptions)
    },

    updateEdge: (id, patch, executeOptions) => {
      history.execute([{ type: 'updateEdge', id, patch }], executeOptions)
    },

    setNodeProperty(id, path, value, executeOptions) {
      editor.setProperty([{ kind: 'node', id }], path, value, executeOptions)
    },

    setEdgeProperty(id, path, value, executeOptions) {
      editor.setProperty([{ kind: 'edge', id }], path, value, executeOptions)
    },

    setProperty(targets, path, value, executeOptions) {
      const operations = targets.flatMap((target) => {
        if (target.kind === 'node') {
          const node = nodeById(target.id)
          if (!node)
            throw new Error(`[flow-designer] node "${target.id}" does not exist`)
          return nodePropertyOperation(node, path, value) ?? []
        }
        const edge = document().edges.find(item => item.id === target.id)
        if (!edge)
          throw new Error(`[flow-designer] edge "${target.id}" does not exist`)
        return edgePropertyOperation(edge, path, value) ?? []
      })
      if (operations.length === 0)
        return
      const subjects = targets.map(target => `${target.kind}:${target.id}`).join(',')
      history.execute(operations, { merge: `property:${subjects}:${formatJsonPath(path)}`, mergeWithin: Infinity, ...executeOptions })
    },

    copy() {
      const copied = snapshot()
      if (copied) {
        clipboard = copied
        pasteCount = 0
      }
      return copied
    },

    cut(executeOptions) {
      const copied = editor.copy()
      if (copied)
        editor.deleteSelection(executeOptions)
      return copied
    },

    paste(source, pasteOptions = {}) {
      if (source !== undefined && !(clipboard && sameClipboard(source, clipboard))) {
        clipboard = source
        pasteCount = 0
      }
      if (!clipboard)
        return EMPTY_SELECTION
      pasteCount++
      return pasteInto(clipboard, (pasteOptions.offset ?? DEFAULT_PASTE_OFFSET) * pasteCount, pasteOptions)
    },

    duplicate(pasteOptions = {}) {
      const copied = snapshot()
      if (!copied)
        return EMPTY_SELECTION
      return pasteInto(copied, pasteOptions.offset ?? DEFAULT_PASTE_OFFSET, pasteOptions)
    },

    align(mode, executeOptions) {
      const nodes = selectedNodes()
      if (nodes.length < 2)
        return
      moveTo(nodes, alignRects(nodes, mode), executeOptions)
    },

    distribute(axis, executeOptions) {
      const nodes = selectedNodes()
      if (nodes.length < 3)
        return
      moveTo(nodes, distributeRects(nodes, axis), executeOptions)
    },

    autoLayout(layoutOptions = {}) {
      const current = document()
      const bounds = unionRects(current.nodes)
      if (!bounds)
        return
      const index = new Map(current.nodes.map((node, i) => [node.id, i]))
      const links = current.edges.flatMap((edge) => {
        const source = index.get(edge.source.node)
        const target = index.get(edge.target.node)
        return source === undefined || target === undefined ? [] : [{ source, target }]
      })
      const layout = layered(current.nodes, links, {
        direction: layoutOptions.direction,
        nodeGap: layoutOptions.nodeGap,
        layerGap: layoutOptions.layerGap,
      })
      const positions = current.nodes.map((node, i) => {
        const placed = layout.nodes[i]!
        return { id: node.id, x: bounds.x + placed.x - node.width / 2, y: bounds.y + placed.y - node.height / 2 }
      })
      history.execute([
        { type: 'moveNodes', positions },
        ...current.edges
          .filter(edge => edge.vertices !== undefined)
          .map((edge): FlowOperation => ({ type: 'updateEdge', id: edge.id, patch: { vertices: null } })),
      ], { label: layoutOptions.label })
    },

    validate: validateOptions => validateDocument(document(), registry, validateOptions),

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return editor
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

function toggle(current: readonly string[], ids: readonly string[]): string[] {
  const result = [...current]
  for (const id of new Set(ids)) {
    const index = result.indexOf(id)
    if (index >= 0)
      result.splice(index, 1)
    else
      result.push(id)
  }
  return result
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

/** 写入节点属性的操作；值没变时为 undefined。 */
function nodePropertyOperation(node: FlowNode, path: JsonPath, value: JsonValue | undefined): FlowOperation | undefined {
  if (path.length === 1 && path[0] === 'label') {
    if (value !== undefined && typeof value !== 'string')
      throw new Error('[flow-designer] node label must be a string')
    return node.label === value ? undefined : { type: 'updateNode', id: node.id, patch: { label: value === undefined ? null : value } }
  }
  if (path[0] !== 'data' || path.length < 2)
    throw new Error(`[flow-designer] node property path "${formatJsonPath(path)}" is not writable`)
  const inner = path.slice(1)
  if (jsonEquals(getJsonAt(node.data, inner), value))
    return undefined
  const data = setJsonAt(node.data ?? {}, inner, value, { createMissing: true }).root
  return { type: 'updateNode', id: node.id, patch: { data: Object.keys(data).length === 0 ? null : data } }
}

/** 写入连线属性的操作；值没变时为 undefined。 */
function edgePropertyOperation(edge: FlowEdge, path: JsonPath, value: JsonValue | undefined): FlowOperation | undefined {
  if (path.length === 1 && path[0] === 'label') {
    if (value !== undefined && typeof value !== 'string')
      throw new Error('[flow-designer] edge label must be a string')
    return edge.label === value ? undefined : { type: 'updateEdge', id: edge.id, patch: { label: value === undefined ? null : value } }
  }
  const field = path[0]
  if ((field !== 'style' && field !== 'data') || path.length < 2)
    throw new Error(`[flow-designer] edge property path "${formatJsonPath(path)}" is not writable`)
  const inner = path.slice(1)
  const current = field === 'style' ? edge.style as JsonObject | undefined : edge.data
  if (jsonEquals(getJsonAt(current, inner), value))
    return undefined
  const next = setJsonAt(current ?? {}, inner, value, { createMissing: true }).root
  const empty = Object.keys(next).length === 0
  return { type: 'updateEdge', id: edge.id, patch: field === 'style' ? { style: empty ? null : next as FlowEdgeStyle } : { data: empty ? null : next } }
}

function sameClipboard(a: FlowClipboard, b: FlowClipboard): boolean {
  return a === b || jsonEquals(a as unknown as JsonValue, b as unknown as JsonValue)
}
