/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-flow-designer>：流程设计器。顶部工具栏、左侧物料面板、中间画布（右下角小地图）、右侧属性面板与底部问题列表；
// 画布上点选、Shift 点选追加、
// 拖动节点（吸附网格与对齐线，一次拖动记一步撤销）、Shift 拖空白框选、拖空白平移、从端口拖出连线，
// 选中一条连线后拖端点改连、拖拐点挪动、拖线段中点加拐点、双击拐点删掉它，
// 物料拖进画布新建节点；Ctrl / ⌘ + 滚轮缩放，键盘删除、撤销重做、复制粘贴与微移。
// 右键节点、连线或空白处弹出内置菜单，宿主取消对应的 *-contextmenu 事件即不弹。
// 面板用 @xihan-ui/web-components 的元素，defineFlowDesigner() 会一并注册它们。

import type {
  FlowConnectionProblem,
  FlowDocument,
  FlowEdgeEnd,
  FlowEdgeRouter,
  FlowEndpoint,
  FlowIssue,
  FlowNode,
  FlowNodeTypeRegistry,
  FlowOperation,
  FlowPoint,
  FlowPropertyDescriptor,
  FlowRect,
  FlowValidateOptions,
} from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowNodeRenderer, FlowScene, FlowSceneEdge, FlowSceneNode } from '@xihan-flow/runtime'
import type { AlignMode, DistributeAxis, ExecuteOptions, SnapGuide, Viewport } from '@xihan-ui/designer-kit'
import type { PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { PointerSession } from '@xihan-ui/pointer'
import type { KeyedChildren, PropertyValues } from '@xihan-ui/web-components/authoring'
import type { FlowAutoLayoutOptions, FlowClipboard, FlowEditor, FlowSelection } from './editor'
import type { FlowPropertyEditor } from './panels/properties'
import { createNodeTypeRegistry, getPortPosition, portAllows } from '@xihan-flow/core'
import { buildScene, createOrthogonalRouter } from '@xihan-flow/runtime'
import { createCounterIdGenerator } from '@xihan-ui/core'
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
import { defineDesignerShell } from '@xihan-ui/designer-shell'
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
import { defineXhElements } from '@xihan-ui/web-components/define'
import { encodeFlowClipboard, readFlowClipboard, writeFlowClipboard } from './clipboard'
import { createFlowEditor } from './editor'
import { ContextMenuPanel } from './panels/context-menu'
import { IssuesPanel } from './panels/issues'
import { MinimapPanel } from './panels/minimap'
import { PalettePanel } from './panels/palette'
import { DEFAULT_EDGE_PROPERTIES, PropertiesPanel } from './panels/properties'
import { ToolbarPanel } from './panels/toolbar'
import { DEFAULT_TRANSLATIONS } from './translations'

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

/** 可以开关的面板。 */
export type FlowDesignerPanel = 'toolbar' | 'palette' | 'properties' | 'issues' | 'minimap'

const EMPTY_SCHEMA: FlowDocument = { version: 1, nodes: [], edges: [] }
const ZOOM_STEP = 1.2
const PAN_STEP = 48
const FIT_PADDING = 24
const EDGE_LAYER_MARGIN = 32
/** 吸附与端口命中的屏幕距离（像素）。 */
const SNAP_DISTANCE = 6
const PORT_HIT_DISTANCE = 12
/** 连线控制柄。 */
const HANDLE_SELECTOR = '[data-part="edge-handle"], [data-part="vertex-handle"], [data-part="segment-handle"]'
/** 画布有焦点时接管的剪贴板事件。 */
const CLIPBOARD_EVENTS = ['copy', 'cut', 'paste'] as const

interface Layers {
  readonly canvas: HTMLElement
  readonly root: HTMLElement
  readonly world: HTMLElement
  readonly edges: SVGSVGElement
  readonly labels: HTMLElement
  readonly nodes: HTMLElement
  readonly ports: HTMLElement
  readonly handles: HTMLElement
  readonly overlay: SVGSVGElement
  readonly marquee: HTMLElement
  readonly dropPreview: HTMLElement
  readonly toolbar: ToolbarPanel
  readonly palette: PalettePanel
  readonly properties: PropertiesPanel
  readonly issues: IssuesPanel
  readonly minimap: MinimapPanel
  readonly menu: ContextMenuPanel
}

interface Gesture {
  readonly kind: 'pan' | 'move' | 'marquee' | 'connect' | 'drop' | 'vertex'
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
    panels: { converter: { fromAttribute: (value: string | null) => value ?? undefined } },
    paletteGroupOrder: { attribute: false },
    paletteGroupLabels: { attribute: false },
    propertyEditors: { attribute: false },
    propertyGroupOrder: { attribute: false },
    propertyGroupLabels: { attribute: false },
    edgeProperties: { attribute: false },
    validateOptions: { attribute: false },
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
  /**
   * 要显示的面板，空格分隔：toolbar palette properties issues minimap。不写即全部显示，写空串则全部收起；
   * 同名 attribute。
   */
  declare panels: string | undefined
  /** 物料面板里先列出的类别及其顺序，其余类别按登记顺序排在后面。 */
  declare paletteGroupOrder: readonly string[] | undefined
  /** 物料面板的类别标题，缺省直接显示 category。 */
  declare paletteGroupLabels: Readonly<Record<string, string>> | undefined
  /**
   * 属性面板的自定义编辑器：按编辑方式（byControl）、属性路径（byPath）或对象种类 + 路径（byTarget）查找，
   * 节点的对象种类是节点类型名，连线是 edge；查不到的内建编辑方式用面板自带的编辑器。
   */
  declare propertyEditors: PropertyEditorTable<FlowPropertyEditor> | undefined
  /** 属性面板里先列出的分组及其顺序，其余分组按首次出现的顺序排在后面。 */
  declare propertyGroupOrder: readonly string[] | undefined
  /** 属性面板的分组标题，缺省直接显示分组 id。 */
  declare propertyGroupLabels: Readonly<Record<string, string>> | undefined
  /** 连线的属性描述，path 相对连线本身；缺省可编辑标签与虚线。 */
  declare edgeProperties: readonly FlowPropertyDescriptor[] | undefined
  /** 校验选项：按问题码覆盖严重程度。 */
  declare validateOptions: FlowValidateOptions | undefined
  /** 自定义节点内容。 */
  declare renderNode: FlowNodeRenderer | undefined
  /** 连线路由器，缺省为直角路由。 */
  declare router: FlowEdgeRouter | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FlowDesignerTranslations> | undefined

  readonly #config = new XhConfigController(this)
  readonly #keys: KeyedChildren = new WeakMap()
  readonly #ids = createCounterIdGenerator('xh-flow')
  readonly #editor: FlowEditor = createFlowEditor({ document: EMPTY_SCHEMA, registry: createNodeTypeRegistry([]) })
  #layers: Layers | undefined
  #defaultRouter: FlowEdgeRouter | undefined
  #scene: FlowScene | undefined
  #sceneStale = true
  #viewport: Viewport = DEFAULT_VIEWPORT
  #autoFit = true
  #fitPending = true
  #gesture: Gesture | undefined
  #guides: readonly SnapGuide[] = []
  #preview: ConnectPreview | undefined
  #marquee: FlowRect | undefined
  #dropPreview: FlowRect | undefined
  #transactionOperations: FlowOperation[] = []
  #dirty = false
  #issuesScheduled = false
  #issues: readonly FlowIssue[] = []
  /** 节点 id → 落在它上面的问题里最严重的那一级。 */
  #issueLevels = new Map<string, 'error' | 'warning'>()
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

  /** 流程定义。赋值时装载、清空撤销历史并重新自动适配（赋回当前这一份不重新装载）；读取时得到当前定义。 */
  get schema(): FlowDocument {
    return this.#editor.document
  }

  set schema(value: FlowDocument) {
    if (value === this.#editor.document)
      return
    this.#startAutoFit()
    this.#editor.load(value)
  }

  get canUndo(): boolean {
    return this.#editor.history.canUndo
  }

  get canRedo(): boolean {
    return this.#editor.history.canRedo
  }

  /** 剪贴板里有内容，paste() 能贴出东西。 */
  get canPaste(): boolean {
    return this.#editor.hasClipboard
  }

  /** 有未保存的修改。 */
  get dirty(): boolean {
    return this.#editor.history.dirty
  }

  override connectedCallback(): void {
    super.connectedCallback()
    const layers = this.#ensureLayers()
    for (const type of CLIPBOARD_EVENTS)
      this.ownerDocument.addEventListener(type, this.#onClipboard)
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver ??= new ResizeObserver(() => this.#onResize())
      this.#resizeObserver.observe(layers.root)
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    for (const type of CLIPBOARD_EVENTS)
      this.ownerDocument.removeEventListener(type, this.#onClipboard)
    this.#resizeObserver?.disconnect()
    this.#cancelGesture()
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    const layers = this.#ensureLayers()
    const t = this.#translations()
    layers.menu.trigger.setAttribute('aria-label', t.label)
    if (changed.has('nodeTypes')) {
      this.#editor.setRegistry(this.nodeTypes ?? createNodeTypeRegistry([]))
      this.#sceneStale = true
      this.#scheduleIssues()
    }
    if (changed.has('router'))
      this.#sceneStale = true
    if (changed.has('edgeProperties') || changed.has('validateOptions'))
      this.#scheduleIssues()
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
    this.#renderHandles(layers)
    this.#renderOverlay(layers)
    this.#renderPanels(layers, t)
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

  /** 复制选中的节点与两端都被选中的连线，同时写进系统剪贴板；没有选中节点时返回 undefined。 */
  copy(): FlowClipboard | undefined {
    const copied = this.#editor.copy()
    if (copied)
      this.#writeSystemClipboard(copied)
    return copied
  }

  /** 复制选中内容后删除选中的节点与连线，同时写进系统剪贴板；只读或没有选中节点时返回 undefined。 */
  cut(): FlowClipboard | undefined {
    if (this.readonly)
      return undefined
    const copied = this.#editor.cut()
    if (copied)
      this.#writeSystemClipboard(copied)
    return copied
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

  /** 按当前节点类型登记表、连线属性描述与校验选项校验定义。 */
  validate(): FlowIssue[] {
    return this.#editor.validate({ ...this.validateOptions, edgeProperties: this.edgeProperties ?? DEFAULT_EDGE_PROPERTIES })
  }

  getViewport(): Viewport {
    return this.#viewport
  }

  /** 设置视口；此后尺寸变化不再自动适配。 */
  setViewport(viewport: Viewport): void {
    this.#stopAutoFit()
    this.#moveTo(viewport)
  }

  /** 缩放并平移到让整张图落在视口中央，小图不放大到 100% 以上；此后尺寸变化时重新适配，直到设置视口或在画布上按下指针。 */
  zoomToFit(): void {
    this.#startAutoFit()
    this.#fitIfPending()
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

  /** 选中问题所在的节点或连线并显露它；问题落在属性上时把焦点交给属性面板里的那个字段。 */
  #locate(issue: FlowIssue): void {
    const target = issue.target
    if (target?.kind === 'node') {
      this.#editor.select({ nodes: [target.id] })
      this.revealNode(target.id)
    }
    else if (target?.kind === 'edge') {
      this.#editor.select({ edges: [target.id] })
      const points = this.#scene?.edges.find(edge => edge.id === target.id)?.points ?? []
      const rect = unionRects(points.map(point => ({ x: point.x, y: point.y, width: 0, height: 0 })))
      const size = this.#size()
      if (rect && size) {
        const next = revealRect(this.#viewport, rect, size, FIT_PADDING)
        if (next !== this.#viewport)
          this.setViewport(next)
      }
    }
    if (!target || issue.path.length <= 2)
      return
    const path = issue.path.slice(2)
    const properties = this.#ensureLayers().properties
    void this.updateComplete
      .then(() => properties.element.updateComplete)
      .then(() => properties.focusField(path))
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
      this.#issues = this.validate()
      this.#issueLevels = new Map()
      for (const issue of this.#issues) {
        if (issue.target?.kind === 'node' && this.#issueLevels.get(issue.target.id) !== 'error')
          this.#issueLevels.set(issue.target.id, issue.severity === 'warning' ? 'warning' : 'error')
      }
      this.requestUpdate()
      emitEvent(this, 'issues-change', { issues: this.#issues })
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
    if (this.#layers?.canvas.isConnected && this.#layers.canvas.parentElement === this)
      return this.#layers
    const doc = this.ownerDocument
    const canvas = createGeneratedElement(doc, 'div')
    canvas.dataset.part = 'canvas'
    const root = createGeneratedElement(doc, 'div')
    root.dataset.part = 'viewport'
    const world = createGeneratedElement(doc, 'div')
    world.dataset.part = 'world'
    const edges = svgLayer(doc, 'edges')
    const labels = createGeneratedElement(doc, 'div')
    labels.dataset.part = 'labels'
    const nodes = createGeneratedElement(doc, 'div')
    nodes.dataset.part = 'nodes'
    const ports = createGeneratedElement(doc, 'div')
    ports.dataset.part = 'ports'
    const handles = createGeneratedElement(doc, 'div')
    handles.dataset.part = 'handles'
    const overlay = svgLayer(doc, 'overlay')
    const marquee = createGeneratedElement(doc, 'div')
    marquee.dataset.part = 'marquee'
    marquee.hidden = true
    const dropPreview = createGeneratedElement(doc, 'div')
    dropPreview.dataset.part = 'drop-preview'
    dropPreview.hidden = true
    world.append(edges, labels, nodes, ports, handles, overlay, marquee, dropPreview)
    root.append(world)
    const minimap = new MinimapPanel({
      ownerDocument: doc,
      scene: () => this.#scene,
      viewport: () => this.#viewport,
      canvasSize: () => this.#size(),
      centerAt: (point) => {
        const size = this.#size()
        if (size)
          this.setViewport(centerOn(this.#viewport, point, size))
      },
    })
    const menu = new ContextMenuPanel(this, root)
    menu.prepare('blank', this.#translations())
    menu.trigger.addEventListener('keydown', this.#onKeyDown)
    canvas.append(menu.element, minimap.element)
    const toolbar = new ToolbarPanel(this)
    const palette = new PalettePanel({
      ownerDocument: doc,
      isReadonly: () => this.readonly,
      nextId: () => this.#ids.scopeId(),
      addNode: type => this.addNode(type),
      startDrag: (event, type, onEnd) => this.#startDrop(event, type, onEnd),
    })
    const properties = new PropertiesPanel({
      ownerDocument: doc,
      editor: this.#editor,
      isReadonly: () => this.readonly,
      issues: () => this.#issues,
      editors: () => this.propertyEditors,
      groupOrder: () => this.propertyGroupOrder,
      groupLabels: () => this.propertyGroupLabels,
      edgeProperties: () => this.edgeProperties,
    })
    const issues = new IssuesPanel({
      ownerDocument: doc,
      nextId: () => this.#ids.scopeId(),
      document: () => this.#editor.document,
      registry: () => this.#editor.registry,
      issues: () => this.#issues,
      edgeProperties: () => this.edgeProperties ?? DEFAULT_EDGE_PROPERTIES,
      locate: issue => this.#locate(issue),
    })
    this.append(toolbar.element, palette.element, canvas, properties.element, issues.element)
    root.addEventListener('pointerdown', this.#onPointerDown)
    root.addEventListener('dblclick', this.#onDoubleClick)
    root.addEventListener('contextmenu', this.#onContextMenu)
    root.addEventListener('wheel', this.#onWheel, { passive: false })
    this.#layers = { canvas, root, world, edges, labels, nodes, ports, handles, overlay, marquee, dropPreview, toolbar, palette, properties, issues, minimap, menu }
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
    toggleData(element, 'issue', this.#issueLevels.get(node.id))
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

  /** 唯一选中且画得出的那条连线；只读时没有。 */
  #editableEdge(): FlowSceneEdge | undefined {
    const { nodes, edges } = this.#editor.selection
    if (this.readonly || nodes.length > 0 || edges.length !== 1)
      return undefined
    const edge = this.#scene?.edges.find(item => item.id === edges[0])
    return edge && edge.anchored && edge.points.length >= 2 ? edge : undefined
  }

  /** 选中连线的控制柄：两端的端点柄、每个拐点的拐点柄与每段中点的加点柄。 */
  #renderHandles(layers: Layers): void {
    const edge = this.#editableEdge()
    const items: { key: string, part: string, at: FlowPoint, end?: FlowEdgeEnd, index?: number }[] = []
    if (edge) {
      const points = edge.points
      items.push({ key: 'source', part: 'edge-handle', end: 'source', at: points[0]! })
      items.push({ key: 'target', part: 'edge-handle', end: 'target', at: points.at(-1)! })
      points.slice(1, -1).forEach((at, index) => items.push({ key: `vertex-${index}`, part: 'vertex-handle', index, at }))
      for (let index = 0; index < points.length - 1; index++) {
        const from = points[index]!
        const to = points[index + 1]!
        items.push({ key: `segment-${index}`, part: 'segment-handle', index, at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } })
      }
    }
    const doc = this.ownerDocument
    reconcile(layers.handles, items, this.#keys, item => item.key, (item, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      element.dataset.part = item.part
      element.dataset.edgeId = edge!.id
      toggleData(element, 'end', item.end)
      toggleData(element, 'index', item.index === undefined ? undefined : String(item.index))
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
    placeBox(layers.marquee, this.#marquee)
    placeBox(layers.dropPreview, this.#dropPreview)
  }

  /** panels 里列出了这个面板，或没有写 panels。 */
  #shows(panel: FlowDesignerPanel): boolean {
    return this.panels === undefined || this.panels.split(/\s+/).includes(panel)
  }

  #renderPanels(layers: Layers, t: FlowDesignerTranslations): void {
    layers.toolbar.element.hidden = !this.#shows('toolbar')
    layers.palette.element.hidden = !this.#shows('palette')
    layers.properties.element.hidden = !this.#shows('properties')
    layers.issues.element.hidden = !this.#shows('issues')
    if (!this.#shows('minimap'))
      layers.minimap.element.hidden = true
    if (!layers.toolbar.element.hidden)
      layers.toolbar.update(t)
    if (!layers.palette.element.hidden)
      layers.palette.update(this.#editor.registry, { order: this.paletteGroupOrder, labels: this.paletteGroupLabels }, t)
    if (!layers.properties.element.hidden)
      layers.properties.update(t)
    if (!layers.issues.element.hidden)
      layers.issues.update(t)
    if (this.#shows('minimap'))
      layers.minimap.update()
  }

  #startAutoFit(): void {
    this.#autoFit = true
    this.#fitPending = true
  }

  #stopAutoFit(): void {
    this.#autoFit = false
    this.#fitPending = false
  }

  #onResize(): void {
    if (!this.#autoFit)
      return
    this.#fitPending = true
    this.#fitIfPending()
  }

  #fitIfPending(): boolean {
    const bounds = this.#scene?.bounds
    const size = this.#size()
    if (!this.#fitPending || !bounds || !size)
      return false
    this.#fitPending = false
    this.#moveTo(fitRect(bounds, size, { padding: FIT_PADDING }))
    return true
  }

  #moveTo(viewport: Viewport): void {
    this.#viewport = viewport
    this.#applyViewport(true)
  }

  #applyViewport(notify: boolean): void {
    const layers = this.#layers
    if (layers) {
      const { x, y, zoom } = this.#viewport
      layers.world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
      layers.world.style.setProperty('--xh-flow-designer-zoom', String(zoom))
      if (this.#shows('minimap'))
        layers.minimap.update()
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
    this.#stopAutoFit()
    const target = event.target instanceof Element ? event.target : undefined
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const handle = target?.closest<HTMLElement>(HANDLE_SELECTOR)
    if (handle && this.contains(handle) && !this.readonly) {
      const edgeId = handle.dataset.edgeId!
      if (handle.dataset.part === 'edge-handle')
        this.#startReconnect(event, edgeId, handle.dataset.end as FlowEdgeEnd)
      else
        this.#startVertexDrag(event, edgeId, handle.dataset.part === 'vertex-handle' ? 'move' : 'insert', Number(handle.dataset.index))
      return
    }
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

  /** 拖连线的一端改连：指针下有端口或节点时显示能不能连，松手时改连，违反约束时派发 connect-reject。 */
  #startReconnect(event: PointerEvent, edgeId: string, end: FlowEdgeEnd): void {
    const edge = this.#editor.document.edges.find(item => item.id === edgeId)
    const points = this.#scene?.edges.find(item => item.id === edgeId)?.points
    if (!edge || !points || points.length < 2)
      return
    const fixed = end === 'source' ? points.at(-1)! : points[0]!
    const pair = (endpoint: FlowEndpoint): { source: FlowEndpoint, target: FlowEndpoint } =>
      end === 'source' ? { source: endpoint, target: edge.target } : { source: edge.source, target: endpoint }
    let endpoint: FlowEndpoint | undefined
    this.#track(event, 'connect', {
      onMove: (client) => {
        const world = this.clientToWorld(client.x, client.y)
        endpoint = this.#endpointAt(world)
        const { source, target } = endpoint ? pair(endpoint) : pair(edge[end])
        const valid = endpoint ? this.#editor.checkConnect(source, target, edgeId).length === 0 : undefined
        const at = endpoint ? this.#anchorOf(endpoint) ?? world : world
        this.#preview = end === 'source' ? { from: at, to: fixed, valid } : { from: fixed, to: at, valid }
        this.requestUpdate()
      },
      onEnd: (active) => {
        this.#preview = undefined
        this.requestUpdate()
        if (!active || !endpoint)
          return
        const result = this.#editor.reconnect(edgeId, end, endpoint)
        if (!result.ok)
          emitEvent(this, 'connect-reject', { ...pair(endpoint), problems: result.problems })
      },
    })
  }

  /** 拖拐点挪动它，或拖线段中点在那里加一个拐点；位置吸附网格，一次拖动记一步撤销。没有手动拐点的连线以路由出的折点为起点。 */
  #startVertexDrag(event: PointerEvent, edgeId: string, mode: 'move' | 'insert', index: number): void {
    const points = this.#scene?.edges.find(item => item.id === edgeId)?.points
    if (!points)
      return
    const interior = points.slice(1, -1)
    this.#track(event, 'vertex', {
      onActivate: () => this.#editor.history.begin(),
      onMove: (client) => {
        const at = this.#snapToGrid(this.clientToWorld(client.x, client.y))
        const vertices = mode === 'move'
          ? interior.map((point, i) => i === index ? at : point)
          : [...interior.slice(0, index), at, ...interior.slice(index)]
        this.#editor.execute([{ type: 'updateEdge', id: edgeId, patch: { vertices } }])
      },
      onEnd: (active) => {
        if (active && this.#editor.history.inTransaction)
          this.#editor.history.commit()
        this.requestUpdate()
      },
    })
  }

  /** 世界坐标处的连接终点：靠近某个端口（exclude 那个端口除外）时取该端口，否则取指针下的节点；都没有时为 undefined。 */
  #endpointAt(world: FlowPoint, exclude?: FlowEndpoint): FlowEndpoint | undefined {
    const nodes = this.#scene?.nodes ?? []
    const reach = PORT_HIT_DISTANCE / this.#viewport.zoom
    let best: { endpoint: FlowEndpoint, distance: number } | undefined
    for (const sceneNode of nodes) {
      for (const port of sceneNode.nodeType?.ports ?? []) {
        if (exclude && sceneNode.id === exclude.node && port.id === exclude.port)
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

  /** 从物料面板拖出一个节点类型：指针在画布上时显示落点，松手在画布上即在落点新建节点。 */
  #startDrop(event: PointerEvent, type: string, onEnd: (dragged: boolean) => void): boolean {
    const nodeType = this.#editor.registry.get(type)
    if (this.readonly || this.#gesture || !nodeType)
      return false
    const { width, height } = nodeType.size
    this.#track(event, 'drop', {
      onMove: (client) => {
        const box = this.#ensureLayers().root.getBoundingClientRect()
        const inside = client.x >= box.left && client.x <= box.right && client.y >= box.top && client.y <= box.bottom
        if (inside) {
          const center = this.clientToWorld(client.x, client.y)
          const topLeft = this.#snapToGrid({ x: center.x - width / 2, y: center.y - height / 2 })
          this.#dropPreview = { ...topLeft, width, height }
        }
        else {
          this.#dropPreview = undefined
        }
        this.requestUpdate()
      },
      onEnd: (active) => {
        const target = this.#dropPreview
        this.#dropPreview = undefined
        this.requestUpdate()
        onEnd(active)
        if (active && target)
          this.#editor.addNode(type, { x: target.x, y: target.y })
      },
    })
    return true
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

  /** 删掉手动拐点；删到一个不剩时交回路由器。路由出的折点没有可删的。 */
  #removeVertex(edgeId: string, index: number): void {
    const edge = this.#editor.document.edges.find(item => item.id === edgeId)
    if (this.readonly || !edge?.vertices || !edge.vertices[index])
      return
    const vertices = edge.vertices.filter((_, i) => i !== index)
    this.#editor.updateEdge(edgeId, { vertices: vertices.length === 0 ? null : vertices })
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
    const vertex = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-part="vertex-handle"]') : null
    if (vertex && this.contains(vertex)) {
      this.#removeVertex(vertex.dataset.edgeId!, Number(vertex.dataset.index))
      return
    }
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
    if (!proceed) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    this.#layers?.menu.prepare(target?.kind ?? 'blank', this.#translations())
  }

  #translations(): FlowDesignerTranslations {
    return this.#config.translations<FlowDesignerTranslations>(FLOW_DESIGNER_TAG, DEFAULT_TRANSLATIONS, this.translations)
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

  /** 写进系统剪贴板，只写 text/plain；写不进时内容只留在设计器内。 */
  #writeSystemClipboard(clipboard: FlowClipboard): void {
    this.ownerDocument.defaultView?.navigator.clipboard?.writeText(encodeFlowClipboard(clipboard)).catch(() => {})
  }

  /** 画布有焦点时，复制、剪切写入剪贴板事件的数据，粘贴读出流程的剪贴板内容；别的内容不处理。 */
  readonly #onClipboard = (event: ClipboardEvent): void => {
    const data = event.clipboardData
    const root = this.getRootNode() as Document | ShadowRoot
    if (!data || this.#gesture || !this.#layers || root.activeElement !== this.#layers.menu.trigger)
      return
    if (event.type === 'paste') {
      const content = this.readonly ? undefined : readFlowClipboard(data)
      if (content) {
        this.paste(content)
        event.preventDefault()
      }
      return
    }
    const copied = event.type === 'copy' ? this.#editor.copy() : this.readonly ? undefined : this.#editor.cut()
    if (!copied)
      return
    writeFlowClipboard(data, copied)
    event.preventDefault()
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      const { nodes, edges } = this.#editor.selection
      this.#layers?.menu.prepare(nodes.length > 0 ? 'node' : edges.length > 0 ? 'edge' : 'blank', this.#translations())
      return
    }
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
  defineXhElements()
  defineDesignerShell()
  registerElement(FLOW_DESIGNER_TAG, XhFlowDesigner)
}

function placeBox(element: HTMLElement, rect: FlowRect | undefined): void {
  element.hidden = rect === undefined
  if (!rect)
    return
  element.style.left = `${rect.x}px`
  element.style.top = `${rect.y}px`
  element.style.width = `${rect.width}px`
  element.style.height = `${rect.height}px`
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
