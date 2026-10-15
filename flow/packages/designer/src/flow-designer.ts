/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-flow-designer>：流程设计器。画布上点选、Shift 点选追加、拖动节点（吸附网格与对齐线，一次拖动记一步撤销）、
// Shift 拖空白框选、拖空白平移、从端口拖出连线；Ctrl / ⌘ + 滚轮缩放，键盘删除、撤销重做、复制粘贴与微移。

import type {
  FlowConnectionProblem,
  FlowDocument,
  FlowEdgeRouter,
  FlowEndpoint,
  FlowIssue,
  FlowNode,
  FlowNodeTypeRegistry,
  FlowOperation,
  FlowPoint,
  FlowRect,
} from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowNodeRenderer, FlowScene, FlowSceneEdge, FlowSceneNode } from '@xihan-flow/runtime'
import type { AlignMode, DistributeAxis, ExecuteOptions, SnapGuide, Viewport } from '@xihan-ui/designer-kit'
import type { PointerSession } from '@xihan-ui/pointer'
import type { KeyedChildren, PropertyValues } from '@xihan-ui/web-components/authoring'
import type { FlowAutoLayoutOptions, FlowClipboard, FlowEditor, FlowSelection } from './editor'
import { createNodeTypeRegistry, getPortPosition, portAllows } from '@xihan-flow/core'
import { buildScene, createOrthogonalRouter } from '@xihan-flow/runtime'
import {
  centerOn,
  DEFAULT_VIEWPORT,
  expandRect,
  fitRect,
  hitTest,
  marqueeModeFromDrag,
  marqueeRect,
  nudgeDelta,
  panBy,
  revealRect,
  screenToWorld,
  selectInMarquee,
  snapPointToGrid,
  snapRect,
  unionRects,
  wheelZoomFactor,
  zoomBy,
} from '@xihan-ui/designer-kit'
import { createPointerSession, resolveSessionDoc, shouldActivate, wheelPixels } from '@xihan-ui/pointer'
import {
  createGeneratedElement,
  emitEvent,
  GEN_ATTR,
  reconcile,
  registerElement,
  SVG_NS,
  XhConfigController,
  XhReactiveElement,
} from '@xihan-ui/web-components/authoring'
import { createFlowEditor } from './editor'

/** 设计器的标签名。 */
export const FLOW_DESIGNER_TAG = 'xh-flow-designer'

/** schema-change 的种类：执行操作、撤销、重做，或宿主装载了新定义。 */
export type FlowSchemaChangeKind = 'execute' | 'undo' | 'redo' | 'load'

/** 设计器派发的事件；x / y 为浏览器视口坐标。 */
export interface FlowDesignerEventMap {
  'schema-change': CustomEvent<{ schema: FlowDocument, operations: readonly FlowOperation[], kind: FlowSchemaChangeKind }>
  'selection-change': CustomEvent<FlowSelection>
  'dirty-change': CustomEvent<{ dirty: boolean }>
  'issues-change': CustomEvent<{ issues: readonly FlowIssue[] }>
  'connect-reject': CustomEvent<{ source: FlowEndpoint, target: FlowEndpoint, problems: readonly FlowConnectionProblem[] }>
  'node-dblclick': CustomEvent<{ id: string }>
  'node-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  'edge-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  'blank-contextmenu': CustomEvent<{ x: number, y: number }>
  'viewport-change': CustomEvent<{ viewport: Viewport }>
  'save': CustomEvent<Record<string, never>>
}

const DEFAULT_TRANSLATIONS: FlowDesignerTranslations = { label: 'Flow designer' }
const EMPTY_SCHEMA: FlowDocument = { version: 1, nodes: [], edges: [] }
const ZOOM_STEP = 1.2
const PAN_STEP = 48
const FIT_PADDING = 24
const EDGE_LAYER_MARGIN = 32
/** 吸附与端口命中的屏幕距离（像素）。 */
const SNAP_DISTANCE = 6
const PORT_HIT_DISTANCE = 12

interface Layers {
  readonly root: HTMLElement
  readonly world: HTMLElement
  readonly edges: SVGSVGElement
  readonly labels: HTMLElement
  readonly nodes: HTMLElement
  readonly ports: HTMLElement
  readonly overlay: SVGSVGElement
  readonly marquee: HTMLElement
}

interface Gesture {
  readonly kind: 'pan' | 'move' | 'marquee' | 'connect'
  readonly session: PointerSession
  active: boolean
}

interface ConnectPreview {
  readonly from: FlowPoint
  readonly to: FlowPoint
  readonly valid: boolean | undefined
}

export class XhFlowDesigner extends XhReactiveElement {
  static override properties = {
    nodeTypes: { attribute: false },
    readonly: { type: Boolean },
    grid: { attribute: false },
    snap: { attribute: false },
    renderNode: { attribute: false },
    router: { attribute: false },
    translations: { attribute: false },
  }

  /** 节点类型登记表，决定端口、连线约束与属性。 */
  declare nodeTypes: FlowNodeTypeRegistry | undefined
  /** 只读：可以选择与浏览，不能修改。 */
  declare readonly: boolean
  /** 拖动与新建节点时吸附的网格边长，false 不吸附网格；缺省 16。 */
  declare grid: number | false
  /** 拖动时吸附其它节点并显示对齐线；缺省 true。 */
  declare snap: boolean
  /** 自定义节点内容。 */
  declare renderNode: FlowNodeRenderer | undefined
  /** 连线路由器，缺省为直角路由。 */
  declare router: FlowEdgeRouter | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FlowDesignerTranslations> | undefined

  readonly #config = new XhConfigController(this)
  readonly #keys: KeyedChildren = new WeakMap()
  readonly #editor: FlowEditor = createFlowEditor({ document: EMPTY_SCHEMA, registry: createNodeTypeRegistry([]) })
  #layers: Layers | undefined
  #defaultRouter: FlowEdgeRouter | undefined
  #scene: FlowScene | undefined
  #sceneStale = true
  #viewport: Viewport = DEFAULT_VIEWPORT
  #fitPending = true
  #gesture: Gesture | undefined
  #guides: readonly SnapGuide[] = []
  #preview: ConnectPreview | undefined
  #marquee: FlowRect | undefined
  #transactionOperations: FlowOperation[] = []
  #dirty = false
  #issuesScheduled = false
  #resizeObserver: ResizeObserver | undefined

  constructor() {
    super()
    this.readonly = false
    this.grid = 16
    this.snap = true
    this.#editor.subscribe((change) => {
      if (change.kind === 'selection') {
        this.requestUpdate()
        emitEvent(this, 'selection-change', change.selection)
        return
      }
      if (change.cause === 'save') {
        this.#syncDirty()
        return
      }
      this.#sceneStale = true
      this.requestUpdate()
      if (change.cause === 'execute' && this.#editor.history.inTransaction) {
        this.#transactionOperations.push(...change.operations)
        return
      }
      if (change.cause === 'rollback') {
        this.#transactionOperations = []
        return
      }
      if (change.cause === 'commit') {
        const operations = this.#transactionOperations
        this.#transactionOperations = []
        if (operations.length > 0)
          this.#emitSchemaChange(operations, 'execute')
      }
      else if (change.cause === 'reset') {
        this.#emitSchemaChange([], 'load')
      }
      else if (change.cause === 'execute' || change.cause === 'undo' || change.cause === 'redo') {
        this.#emitSchemaChange(change.operations, change.cause)
      }
      this.#syncDirty()
      this.#scheduleIssues()
    })
  }

  /** 流程定义。赋值时装载并清空撤销历史（赋回当前这一份不重新装载）；读取时得到当前定义。 */
  get schema(): FlowDocument {
    return this.#editor.document
  }

  set schema(value: FlowDocument) {
    if (value === this.#editor.document)
      return
    this.#fitPending = true
    this.#editor.load(value)
  }

  get canUndo(): boolean {
    return this.#editor.history.canUndo
  }

  get canRedo(): boolean {
    return this.#editor.history.canRedo
  }

  /** 有未保存的修改。 */
  get dirty(): boolean {
    return this.#editor.history.dirty
  }

  override connectedCallback(): void {
    super.connectedCallback()
    const layers = this.#ensureLayers()
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver ??= new ResizeObserver(() => this.#fitIfPending())
      this.#resizeObserver.observe(layers.root)
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resizeObserver?.disconnect()
    this.#cancelGesture()
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    const layers = this.#ensureLayers()
    const t = this.#config.translations<FlowDesignerTranslations>(FLOW_DESIGNER_TAG, DEFAULT_TRANSLATIONS, this.translations)
    layers.root.setAttribute('aria-label', t.label)
    if (changed.has('nodeTypes')) {
      this.#editor.setRegistry(this.nodeTypes ?? createNodeTypeRegistry([]))
      this.#sceneStale = true
      this.#scheduleIssues()
    }
    if (changed.has('router'))
      this.#sceneStale = true
    if (this.readonly)
      this.setAttribute('data-readonly', '')
    else
      this.removeAttribute('data-readonly')
    if (this.#sceneStale || !this.#scene) {
      this.#scene = buildScene(this.#editor.document, this.#editor.registry, { route: this.#route() })
      this.#sceneStale = false
    }
    const selection = this.#editor.selection
    this.#renderEdges(layers, new Set(selection.edges))
    this.#renderLabels(layers)
    this.#renderNodes(layers, new Set(selection.nodes))
    this.#renderPorts(layers)
    this.#renderOverlay(layers)
    if (!this.#fitIfPending())
      this.#applyViewport(false)
  }

  /** 执行一组操作并记为一步撤销；返回新的定义。 */
  execute(operations: readonly FlowOperation[], options?: ExecuteOptions): FlowDocument {
    return this.#editor.execute(operations, options)
  }

  undo(): boolean {
    return this.#editor.undo()
  }

  redo(): boolean {
    return this.#editor.redo()
  }

  /** 把当前状态记为已保存。 */
  markSaved(): void {
    this.#editor.history.markSaved()
  }

  /** 新建节点并选中：at 是节点中心的世界坐标，缺省放在视口中央；位置吸附网格。 */
  addNode(type: string, at?: FlowPoint): FlowNode {
    const nodeType = this.#editor.registry.get(type)
    if (!nodeType)
      throw new Error(`[flow-designer] node type "${type}" is not registered`)
    const center = at ?? this.#viewportCenter()
    const topLeft = this.#snapToGrid({ x: center.x - nodeType.size.width / 2, y: center.y - nodeType.size.height / 2 })
    return this.#editor.addNode(type, topLeft)
  }

  select(selection: Partial<FlowSelection>): void {
    this.#editor.select(selection)
  }

  getSelection(): FlowSelection {
    return this.#editor.selection
  }

  deleteSelection(): boolean {
    return !this.readonly && this.#editor.deleteSelection()
  }

  copy(): FlowClipboard | undefined {
    return this.#editor.copy()
  }

  paste(clipboard?: FlowClipboard): FlowSelection {
    return this.readonly ? { nodes: [], edges: [] } : this.#editor.paste(clipboard, { offset: this.#gridStep() })
  }

  duplicate(): FlowSelection {
    return this.readonly ? { nodes: [], edges: [] } : this.#editor.duplicate({ offset: this.#gridStep() })
  }

  align(mode: AlignMode): void {
    if (!this.readonly)
      this.#editor.align(mode)
  }

  distribute(axis: DistributeAxis): void {
    if (!this.readonly)
      this.#editor.distribute(axis)
  }

  autoLayout(options?: FlowAutoLayoutOptions): void {
    if (!this.readonly)
      this.#editor.autoLayout(options)
  }

  /** 按当前节点类型登记表校验定义。 */
  validate(): FlowIssue[] {
    return this.#editor.validate()
  }

  getViewport(): Viewport {
    return this.#viewport
  }

  setViewport(viewport: Viewport): void {
    this.#viewport = viewport
    this.#fitPending = false
    this.#applyViewport(true)
  }

  /** 缩放并平移到让整张图落在视口中央，小图不放大到 100% 以上。 */
  zoomToFit(): void {
    const bounds = this.#scene?.bounds
    const size = this.#size()
    if (!bounds || !size)
      return
    this.setViewport(fitRect(bounds, size, { padding: FIT_PADDING }))
  }

  zoomIn(): void {
    this.#zoomAtCenter(ZOOM_STEP)
  }

  zoomOut(): void {
    this.#zoomAtCenter(1 / ZOOM_STEP)
  }

  /** 缩放到 100% 并把整张图居中。 */
  zoomToActual(): void {
    const bounds = this.#scene?.bounds
    const size = this.#size()
    if (!size)
      return
    const center = bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : { x: 0, y: 0 }
    this.setViewport(centerOn({ x: 0, y: 0, zoom: 1 }, center, size))
  }

  scrollToNode(id: string): void {
    const rect = this.#nodeRect(id)
    const size = this.#size()
    if (rect && size)
      this.setViewport(centerOn(this.#viewport, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, size))
  }

  /** 节点没整个落在视口内时把它居中，已在视口内则不动。 */
  revealNode(id: string): void {
    const rect = this.#nodeRect(id)
    const size = this.#size()
    if (!rect || !size)
      return
    const next = revealRect(this.#viewport, rect, size, FIT_PADDING)
    if (next !== this.#viewport)
      this.setViewport(next)
  }

  /** 浏览器视口坐标换成画布的世界坐标。 */
  clientToWorld(clientX: number, clientY: number): FlowPoint {
    const box = this.#ensureLayers().root.getBoundingClientRect()
    return screenToWorld(this.#viewport, { x: clientX - box.left, y: clientY - box.top })
  }

  #emitSchemaChange(operations: readonly FlowOperation[], kind: FlowSchemaChangeKind): void {
    emitEvent(this, 'schema-change', { schema: this.#editor.document, operations, kind })
  }

  #syncDirty(): void {
    const dirty = this.#editor.history.dirty
    if (dirty === this.#dirty)
      return
    this.#dirty = dirty
    emitEvent(this, 'dirty-change', { dirty })
  }

  #scheduleIssues(): void {
    if (this.#issuesScheduled)
      return
    this.#issuesScheduled = true
    queueMicrotask(() => {
      this.#issuesScheduled = false
      emitEvent(this, 'issues-change', { issues: this.#editor.validate() })
    })
  }

  #route(): FlowEdgeRouter {
    if (this.router)
      return this.router
    this.#defaultRouter ??= createOrthogonalRouter()
    return this.#defaultRouter
  }

  #gridStep(): number {
    return this.grid === false || !(this.grid > 0) ? 24 : this.grid
  }

  #snapToGrid(point: FlowPoint): FlowPoint {
    return this.grid === false || !(this.grid > 0) ? point : snapPointToGrid(point, this.grid)
  }

  #ensureLayers(): Layers {
    if (this.#layers?.root.isConnected && this.#layers.root.parentElement === this)
      return this.#layers
    const doc = this.ownerDocument
    const root = createGeneratedElement(doc, 'div')
    root.dataset.part = 'viewport'
    root.setAttribute('role', 'region')
    root.tabIndex = 0
    const world = createGeneratedElement(doc, 'div')
    world.dataset.part = 'world'
    const edges = svgLayer(doc, 'edges')
    const labels = createGeneratedElement(doc, 'div')
    labels.dataset.part = 'labels'
    const nodes = createGeneratedElement(doc, 'div')
    nodes.dataset.part = 'nodes'
    const ports = createGeneratedElement(doc, 'div')
    ports.dataset.part = 'ports'
    const overlay = svgLayer(doc, 'overlay')
    const marquee = createGeneratedElement(doc, 'div')
    marquee.dataset.part = 'marquee'
    marquee.hidden = true
    world.append(edges, labels, nodes, ports, overlay, marquee)
    root.append(world)
    this.append(root)
    root.addEventListener('pointerdown', this.#onPointerDown)
    root.addEventListener('dblclick', this.#onDoubleClick)
    root.addEventListener('contextmenu', this.#onContextMenu)
    root.addEventListener('wheel', this.#onWheel, { passive: false })
    root.addEventListener('keydown', this.#onKeyDown)
    this.#layers = { root, world, edges, labels, nodes, ports, overlay, marquee }
    return this.#layers
  }

  #renderEdges(layers: Layers, selected: ReadonlySet<string>): void {
    const scene = this.#scene
    const edges = scene?.edges.filter(edge => edge.path !== '') ?? []
    placeSvgLayer(layers.edges, scene?.bounds)
    const doc = this.ownerDocument
    reconcile(layers.edges, edges, this.#keys, edge => edge.id, (edge, reuse) => {
      const group = reuse ?? createEdgeGroup(doc)
      paintEdge(group, edge, selected.has(edge.id))
      return group
    })
  }

  #renderLabels(layers: Layers): void {
    const labeled = this.#scene?.edges.filter(edge => edge.label !== undefined && edge.labelPoint !== undefined) ?? []
    const doc = this.ownerDocument
    reconcile(layers.labels, labeled, this.#keys, edge => edge.id, (edge, reuse) => {
      const label = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      label.dataset.part = 'edge-label'
      label.dataset.edgeId = edge.id
      label.textContent = edge.label ?? ''
      label.style.left = `${edge.labelPoint!.x}px`
      label.style.top = `${edge.labelPoint!.y}px`
      return label
    })
  }

  #renderNodes(layers: Layers, selected: ReadonlySet<string>): void {
    const doc = this.ownerDocument
    reconcile(layers.nodes, this.#scene?.nodes ?? [], this.#keys, node => node.id, (sceneNode, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      this.#paintNode(element, sceneNode, selected.has(sceneNode.id))
      return element
    })
  }

  #paintNode(element: HTMLElement, sceneNode: FlowSceneNode, selected: boolean): void {
    const { node, rect } = sceneNode
    element.dataset.part = 'node'
    element.dataset.nodeId = node.id
    element.dataset.nodeType = node.type
    toggleData(element, 'selected', selected ? '' : undefined)
    element.style.left = `${rect.x}px`
    element.style.top = `${rect.y}px`
    element.style.width = `${rect.width}px`
    element.style.height = `${rect.height}px`
    if (this.renderNode)
      this.renderNode(element, { node, nodeType: sceneNode.nodeType, label: sceneNode.label, status: undefined, highlighted: false })
    else if (element.textContent !== sceneNode.label)
      element.textContent = sceneNode.label
  }

  #renderPorts(layers: Layers): void {
    const ports = (this.#scene?.nodes ?? []).flatMap(sceneNode =>
      (sceneNode.nodeType?.ports ?? []).map(port => ({ sceneNode, port, at: getPortPosition(sceneNode.rect, port) })))
    const doc = this.ownerDocument
    reconcile(layers.ports, ports, this.#keys, item => `${item.sceneNode.id}\u0000${item.port.id}`, (item, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      element.dataset.part = 'port'
      element.dataset.nodeId = item.sceneNode.id
      element.dataset.portId = item.port.id
      element.dataset.direction = item.port.direction
      element.style.left = `${item.at.x}px`
      element.style.top = `${item.at.y}px`
      return element
    })
  }

  #renderOverlay(layers: Layers): void {
    const scene = this.#scene
    placeSvgLayer(layers.overlay, scene?.bounds)
    const doc = this.ownerDocument
    const shapes: { key: string, d: string, part: string, valid?: boolean }[] = this.#guides.map((guide, index) => ({
      key: `guide-${index}`,
      part: 'guide',
      d: guide.axis === 'x' ? `M${guide.position},${guide.from}V${guide.to}` : `M${guide.from},${guide.position}H${guide.to}`,
    }))
    const preview = this.#preview
    if (preview)
      shapes.push({ key: 'preview', part: 'connect-preview', d: `M${preview.from.x},${preview.from.y}L${preview.to.x},${preview.to.y}`, valid: preview.valid })
    reconcile(layers.overlay, shapes, this.#keys, shape => shape.key, (shape, reuse) => {
      const path = reuse ?? doc.createElementNS(SVG_NS, 'path')
      path.setAttribute(GEN_ATTR, '')
      path.setAttribute('data-part', shape.part)
      path.setAttribute('d', shape.d)
      if (shape.valid === undefined)
        path.removeAttribute('data-valid')
      else
        path.setAttribute('data-valid', String(shape.valid))
      return path
    })
    const marquee = this.#marquee
    layers.marquee.hidden = marquee === undefined
    if (marquee) {
      layers.marquee.style.left = `${marquee.x}px`
      layers.marquee.style.top = `${marquee.y}px`
      layers.marquee.style.width = `${marquee.width}px`
      layers.marquee.style.height = `${marquee.height}px`
    }
  }

  #fitIfPending(): boolean {
    if (!this.#fitPending || !this.#scene?.bounds || !this.#size())
      return false
    this.#fitPending = false
    this.zoomToFit()
    return true
  }

  #applyViewport(notify: boolean): void {
    const world = this.#layers?.world
    if (world) {
      const { x, y, zoom } = this.#viewport
      world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    }
    if (notify)
      emitEvent(this, 'viewport-change', { viewport: this.#viewport })
  }

  #size(): { width: number, height: number } | undefined {
    const root = this.#layers?.root
    if (!root || root.clientWidth === 0 || root.clientHeight === 0)
      return undefined
    return { width: root.clientWidth, height: root.clientHeight }
  }

  #viewportCenter(): FlowPoint {
    const size = this.#size()
    return size ? screenToWorld(this.#viewport, { x: size.width / 2, y: size.height / 2 }) : { x: 0, y: 0 }
  }

  #nodeRect(id: string): FlowRect | undefined {
    return this.#scene?.nodes.find(node => node.id === id)?.rect
  }

  #zoomAtCenter(factor: number): void {
    const size = this.#size()
    if (size)
      this.setViewport(zoomBy(this.#viewport, factor, { x: size.width / 2, y: size.height / 2 }))
  }

  /** 跟随一次按下：位移过了激活距离才算拖动；结束时告知是否拖动过。 */
  #track(
    event: PointerEvent,
    kind: Gesture['kind'],
    handlers: { readonly onActivate?: () => void, readonly onMove: (client: FlowPoint) => void, readonly onEnd: (active: boolean) => void },
  ): void {
    const start = { x: event.clientX, y: event.clientY }
    const gesture: Gesture = {
      kind,
      active: false,
      session: createPointerSession({
        doc: resolveSessionDoc(this),
        pointerId: event.pointerId,
        onMove: ({ point }) => {
          if (!gesture.active) {
            if (!shouldActivate({ x: point.clientX - start.x, y: point.clientY - start.y }))
              return
            gesture.active = true
            this.#layers?.root.setAttribute('data-gesture', kind)
            handlers.onActivate?.()
          }
          handlers.onMove({ x: point.clientX, y: point.clientY })
        },
        onEnd: () => {
          gesture.session.dispose()
          if (this.#gesture === gesture)
            this.#gesture = undefined
          this.#layers?.root.removeAttribute('data-gesture')
          handlers.onEnd(gesture.active)
        },
      }),
    }
    this.#gesture = gesture
  }

  #cancelGesture(): void {
    const gesture = this.#gesture
    if (!gesture)
      return
    gesture.session.dispose()
    this.#gesture = undefined
    this.#layers?.root.removeAttribute('data-gesture')
    if (this.#editor.history.inTransaction)
      this.#editor.history.rollback()
    this.#guides = []
    this.#preview = undefined
    this.#marquee = undefined
    this.requestUpdate()
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#gesture)
      return
    const target = event.target instanceof Element ? event.target : undefined
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const port = target?.closest<HTMLElement>('[data-part="port"]')
    if (port && this.contains(port) && !this.readonly) {
      this.#startConnect(event, port.dataset.nodeId!, port.dataset.portId!)
      return
    }
    const node = target?.closest<HTMLElement>('[data-part="node"]')
    if (node && this.contains(node)) {
      this.#pressNode(event, node.dataset.nodeId!, additive)
      return
    }
    const edge = target?.closest('[data-edge-id]')
    if (edge && this.contains(edge)) {
      const id = edge.getAttribute('data-edge-id')!
      this.#editor.select({ edges: [id] }, additive ? 'toggle' : 'replace')
      return
    }
    if (event.shiftKey)
      this.#startMarquee(event, event.ctrlKey || event.metaKey)
    else
      this.#startPan(event)
  }

  #pressNode(event: PointerEvent, id: string, additive: boolean): void {
    const selected = this.#editor.selection.nodes.includes(id)
    if (additive) {
      this.#editor.select({ nodes: [id] }, 'toggle')
      if (selected)
        return
    }
    else if (!selected) {
      this.#editor.select({ nodes: [id] })
    }
    if (this.readonly)
      return
    this.#startMove(event)
  }

  #startMove(event: PointerEvent): void {
    const ids = new Set(this.#editor.selection.nodes)
    const nodes = this.#editor.document.nodes
    const moving = nodes.filter(node => ids.has(node.id))
    const others = nodes.filter(node => !ids.has(node.id)).map(node => ({ x: node.x, y: node.y, width: node.width, height: node.height }))
    const bounds = unionRects(moving)
    if (!bounds)
      return
    const start = { x: event.clientX, y: event.clientY }
    this.#track(event, 'move', {
      onActivate: () => this.#editor.history.begin(),
      onMove: (client) => {
        const zoom = this.#viewport.zoom
        let dx = (client.x - start.x) / zoom
        let dy = (client.y - start.y) / zoom
        const grid = this.grid === false || !(this.grid > 0) ? undefined : this.grid
        if (this.snap || grid !== undefined) {
          const snapped = snapRect({ ...bounds, x: bounds.x + dx, y: bounds.y + dy }, {
            targets: this.snap ? others : [],
            threshold: SNAP_DISTANCE / zoom,
            ...(grid === undefined ? {} : { grid }),
          })
          dx += snapped.dx
          dy += snapped.dy
          this.#guides = snapped.guides
        }
        this.#editor.execute([{ type: 'moveNodes', positions: moving.map(node => ({ id: node.id, x: node.x + dx, y: node.y + dy })) }])
      },
      onEnd: (active) => {
        this.#guides = []
        if (active && this.#editor.history.inTransaction)
          this.#editor.history.commit()
        this.requestUpdate()
      },
    })
  }

  #startConnect(event: PointerEvent, nodeId: string, portId: string): void {
    const sceneNode = this.#scene?.nodes.find(node => node.id === nodeId)
    const port = sceneNode?.nodeType?.ports.find(item => item.id === portId)
    if (!sceneNode || !port || !portAllows(port, 'source'))
      return
    const source: FlowEndpoint = { node: nodeId, port: portId }
    const from = getPortPosition(sceneNode.rect, port)
    let target: FlowEndpoint | undefined
    this.#track(event, 'connect', {
      onMove: (client) => {
        const world = this.clientToWorld(client.x, client.y)
        target = this.#endpointAt(world, source)
        const valid = target ? this.#editor.checkConnect(source, target).length === 0 : undefined
        this.#preview = { from, to: target ? this.#anchorOf(target) ?? world : world, valid }
        this.requestUpdate()
      },
      onEnd: (active) => {
        this.#preview = undefined
        this.requestUpdate()
        if (!active || !target)
          return
        const result = this.#editor.connect(source, target)
        if (!result.ok)
          emitEvent(this, 'connect-reject', { source, target, problems: result.problems })
      },
    })
  }

  /** 世界坐标处的连接终点：靠近某个端口（起点那个端口除外）时取该端口，否则取指针下的节点；都没有时为 undefined。 */
  #endpointAt(world: FlowPoint, source: FlowEndpoint): FlowEndpoint | undefined {
    const nodes = this.#scene?.nodes ?? []
    const reach = PORT_HIT_DISTANCE / this.#viewport.zoom
    let best: { endpoint: FlowEndpoint, distance: number } | undefined
    for (const sceneNode of nodes) {
      for (const port of sceneNode.nodeType?.ports ?? []) {
        if (sceneNode.id === source.node && port.id === source.port)
          continue
        const at = getPortPosition(sceneNode.rect, port)
        const distance = Math.hypot(at.x - world.x, at.y - world.y)
        if (distance <= reach && (!best || distance < best.distance))
          best = { endpoint: { node: sceneNode.id, port: port.id }, distance }
      }
    }
    if (best)
      return best.endpoint
    const index = hitTest(world, nodes.map(node => node.rect))
    return index < 0 ? undefined : { node: nodes[index]!.id }
  }

  #anchorOf(endpoint: FlowEndpoint): FlowPoint | undefined {
    const sceneNode = this.#scene?.nodes.find(node => node.id === endpoint.node)
    if (!sceneNode)
      return undefined
    const port = endpoint.port === undefined ? undefined : sceneNode.nodeType?.ports.find(item => item.id === endpoint.port)
    if (port)
      return getPortPosition(sceneNode.rect, port)
    return { x: sceneNode.rect.x + sceneNode.rect.width / 2, y: sceneNode.rect.y + sceneNode.rect.height / 2 }
  }

  #startMarquee(event: PointerEvent, additive: boolean): void {
    const start = this.clientToWorld(event.clientX, event.clientY)
    const before = this.#editor.selection.nodes
    this.#track(event, 'marquee', {
      onMove: (client) => {
        const current = this.clientToWorld(client.x, client.y)
        const rect = marqueeRect(start, current)
        const nodes = this.#scene?.nodes ?? []
        const hits = selectInMarquee(rect, nodes.map(node => node.rect), marqueeModeFromDrag(start, current)).map(index => nodes[index]!.id)
        this.#marquee = rect
        this.#editor.select({ nodes: additive ? [...before, ...hits] : hits, edges: [] })
        this.requestUpdate()
      },
      onEnd: (active) => {
        this.#marquee = undefined
        if (!active && !additive)
          this.#editor.clearSelection()
        this.requestUpdate()
      },
    })
  }

  #startPan(event: PointerEvent): void {
    let last = { x: event.clientX, y: event.clientY }
    this.#track(event, 'pan', {
      onMove: (client) => {
        this.setViewport(panBy(this.#viewport, client.x - last.x, client.y - last.y))
        last = client
      },
      onEnd: (active) => {
        if (!active)
          this.#editor.clearSelection()
      },
    })
  }

  #targetOf(event: Event): { kind: 'node' | 'edge', id: string } | undefined {
    const target = event.target instanceof Element ? event.target : undefined
    const node = target?.closest<HTMLElement>('[data-part="node"]')
    if (node?.dataset.nodeId !== undefined && this.contains(node))
      return { kind: 'node', id: node.dataset.nodeId }
    const edge = target?.closest('[data-edge-id]')
    const edgeId = edge?.getAttribute('data-edge-id')
    if (edge && edgeId !== null && edgeId !== undefined && this.contains(edge))
      return { kind: 'edge', id: edgeId }
    return undefined
  }

  readonly #onDoubleClick = (event: MouseEvent): void => {
    const target = this.#targetOf(event)
    if (target?.kind === 'node')
      emitEvent(this, 'node-dblclick', { id: target.id })
  }

  readonly #onContextMenu = (event: MouseEvent): void => {
    const target = this.#targetOf(event)
    const position = { x: event.clientX, y: event.clientY }
    if (target && !(target.kind === 'node' ? this.#editor.selection.nodes : this.#editor.selection.edges).includes(target.id))
      this.#editor.select(target.kind === 'node' ? { nodes: [target.id] } : { edges: [target.id] })
    const proceed = target
      ? emitEvent(this, `${target.kind}-contextmenu`, { id: target.id, ...position }, { cancelable: true })
      : emitEvent(this, 'blank-contextmenu', position, { cancelable: true })
    if (!proceed)
      event.preventDefault()
  }

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      const box = this.#layers!.root.getBoundingClientRect()
      this.setViewport(zoomBy(this.#viewport, wheelZoomFactor(event.deltaY, event.deltaMode), { x: event.clientX - box.left, y: event.clientY - box.top }))
      return
    }
    const pixels = wheelPixels(event, { page: this.#size()?.height })
    this.setViewport(panBy(this.#viewport, -pixels.x, -pixels.y))
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#gesture) {
      this.#cancelGesture()
      event.preventDefault()
      return
    }
    if (this.#gesture)
      return
    const command = event.ctrlKey || event.metaKey
    if (command && !event.altKey && this.#onCommandKey(event))
      event.preventDefault()
    else if (!command && !event.altKey && this.#onPlainKey(event))
      event.preventDefault()
  }

  #onCommandKey(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase()
    if (key === 's') {
      emitEvent(this, 'save', {})
      return true
    }
    if (key === 'a') {
      this.#editor.selectAll()
      return true
    }
    if (key === 'c') {
      this.#editor.copy()
      return true
    }
    if (this.readonly)
      return false
    if (key === 'z') {
      if (event.shiftKey)
        this.#editor.redo()
      else
        this.#editor.undo()
      return true
    }
    if (key === 'y') {
      this.#editor.redo()
      return true
    }
    if (key === 'v') {
      this.paste()
      return true
    }
    if (key === 'd') {
      this.duplicate()
      return true
    }
    return false
  }

  #onPlainKey(event: KeyboardEvent): boolean {
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        return this.deleteSelection()
      case '+':
      case '=':
        this.zoomIn()
        return true
      case '-':
        this.zoomOut()
        return true
      case '0':
        this.zoomToFit()
        return true
    }
    const delta = nudgeDelta(event.key, { large: event.shiftKey, largeStep: this.#gridStep() })
    if (!delta)
      return false
    const ids = this.#editor.selection.nodes
    if (ids.length > 0 && !this.readonly) {
      this.#editor.moveNodes(ids, delta.dx, delta.dy, { merge: 'nudge' })
      return true
    }
    this.setViewport(panBy(this.#viewport, -Math.sign(delta.dx) * PAN_STEP, -Math.sign(delta.dy) * PAN_STEP))
    return true
  }
}

/** 注册 <xh-flow-designer>；重复调用不报错。 */
export function defineFlowDesigner(): void {
  registerElement(FLOW_DESIGNER_TAG, XhFlowDesigner)
}

function svgLayer(doc: Document, part: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute(GEN_ATTR, '')
  svg.setAttribute('data-part', part)
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

function placeSvgLayer(svg: SVGSVGElement, bounds: FlowRect | undefined): void {
  const box = bounds ? expandRect(bounds, EDGE_LAYER_MARGIN) : { x: 0, y: 0, width: 0, height: 0 }
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
  svg.setAttribute('width', String(box.width))
  svg.setAttribute('height', String(box.height))
  svg.style.left = `${box.x}px`
  svg.style.top = `${box.y}px`
}

function createEdgeGroup(doc: Document): SVGGElement {
  const group = doc.createElementNS(SVG_NS, 'g')
  group.setAttribute(GEN_ATTR, '')
  group.setAttribute('data-part', 'edge')
  for (const part of ['edge-hit', 'edge-line', 'edge-arrow']) {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('data-part', part)
    group.append(path)
  }
  return group
}

function paintEdge(group: Element, edge: FlowSceneEdge, selected: boolean): void {
  group.setAttribute('data-edge-id', edge.id)
  toggleAttribute(group, 'data-dashed', edge.dashed)
  toggleAttribute(group, 'data-selected', selected)
  const [hit, line, arrow] = Array.from(group.children)
  hit!.setAttribute('d', edge.path)
  line!.setAttribute('d', edge.path)
  arrow!.setAttribute('d', edge.arrow)
}

function toggleAttribute(element: Element, name: string, on: boolean): void {
  if (on)
    element.setAttribute(name, '')
  else
    element.removeAttribute(name)
}

function toggleData(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined)
    delete element.dataset[key]
  else
    element.dataset[key] = value
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-flow-designer': XhFlowDesigner
  }
}
