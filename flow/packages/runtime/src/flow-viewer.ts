/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-flow-viewer>：只读流程图查看器。按流程定义与节点类型画出节点、连线、箭头与标签，叠加运行状态与高亮；
// 拖动平移，Ctrl / ⌘ + 滚轮缩放，滚轮平移；获得焦点后 + / - / 0 缩放、方向键平移。

import type { FlowDocument, FlowEdgeRouter, FlowNode, FlowNodeType, FlowRect } from '@xihan-flow/core'
import type { Viewport } from '@xihan-ui/designer-kit'
import type { PointerSession } from '@xihan-ui/pointer'
import type { KeyedChildren, PropertyValues } from '@xihan-ui/web-components/authoring'
import type { FlowRuntimeExtension, FlowRuntimeModel } from './extensions'
import type { FlowNodeStatus, FlowScene, FlowSceneEdge, FlowSceneNode } from './scene'
import type { FlowViewerTranslations } from './translations'
import { centerOn, DEFAULT_VIEWPORT, expandRect, fitRect, panBy, revealRect, wheelZoomFactor, zoomBy } from '@xihan-ui/designer-kit'
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
import { defineXhElement, XhIconElement } from '@xihan-ui/web-components/define'
import { createFlowRuntimeModel } from './extensions'
import { defaultNodeRenderer } from './node-renderer'
import { createOrthogonalRouter } from './router'
import { buildScene } from './scene'

/** 查看器的标签名。 */
export const FLOW_VIEWER_TAG = 'xh-flow-viewer'

/** 自定义节点内容时拿到的上下文。 */
export interface FlowNodeRenderContext {
  /** 要画的节点。 */
  readonly node: FlowNode
  /** 节点类型；类型没有登记时为 undefined。 */
  readonly nodeType: FlowNodeType | undefined
  /** 要显示的文字：节点的 label，没有时取节点类型的名称，再没有取节点 id。 */
  readonly label: string
  /** 节点此刻的运行状态；没有状态时为 undefined。 */
  readonly status: FlowNodeStatus | undefined
  /** 节点是否高亮。 */
  readonly highlighted: boolean
}

/** 自定义节点内容：每次绘制都会调用，把内容写进 container；不给时用 defaultNodeRenderer。 */
export type FlowNodeRenderer = (container: HTMLElement, context: FlowNodeRenderContext) => void

/** 查看器派发的事件；x / y 为浏览器视口坐标。 */
export interface FlowViewerEventMap {
  /** 点了节点；拖动平移之后松手不算点击。 */
  'node-click': CustomEvent<{ id: string }>
  /** 点了连线或连线标签。 */
  'edge-click': CustomEvent<{ id: string }>
  /** 点了画布空白处。 */
  'blank-click': CustomEvent<Record<string, never>>
  /** 在节点上打开右键菜单；可以取消，取消后浏览器的右键菜单也不出现。 */
  'node-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  /** 在连线上打开右键菜单；可以取消。 */
  'edge-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  /** 在画布空白处打开右键菜单；可以取消。 */
  'blank-contextmenu': CustomEvent<{ x: number, y: number }>
  /** 视口变了：缩放、平移、适配与 setViewport 都会派发。 */
  'viewport-change': CustomEvent<{ viewport: Viewport }>
}

const DEFAULT_TRANSLATIONS: FlowViewerTranslations = { label: 'Flow diagram' }
const ZOOM_STEP = 1.2
const PAN_STEP = 48
const FIT_PADDING = 24
const EDGE_LAYER_MARGIN = 32

interface Layers {
  readonly root: HTMLElement
  readonly world: HTMLElement
  readonly edges: SVGSVGElement
  readonly labels: HTMLElement
  readonly nodes: HTMLElement
}

/** 流程查看器 <xh-flow-viewer>：只读显示流程、运行状态与高亮。 */
export class XhFlowViewer extends XhReactiveElement {
  static override properties = {
    schema: { attribute: false },
    extensions: { attribute: false },
    statuses: { attribute: false },
    highlighted: { attribute: false },
    router: { attribute: false },
    translations: { attribute: false },
  }

  /** 要显示的流程定义；从无到有时重新自动适配。 */
  declare schema: FlowDocument | undefined
  /**
   * 扩展：节点类型、节点渲染等都从这里来，内置扩展自动排在最前。赋值时当场合并查重，冲突抛 DesignerExtensionError、
   * 属性保持原值；同一个扩展对象换了引用当作卸下再装上，宿主要保持引用稳定。
   */
  declare extensions: readonly FlowRuntimeExtension[] | undefined
  /** 节点 id → 运行状态；null 表示没有状态。 */
  declare statuses: Readonly<Record<string, FlowNodeStatus | null>> | undefined
  /** 高亮的节点 id。 */
  declare highlighted: readonly string[] | undefined
  /** 连线路由器，缺省为直角路由。 */
  declare router: FlowEdgeRouter | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FlowViewerTranslations> | undefined

  readonly #config = new XhConfigController(this)
  readonly #keys: KeyedChildren = new WeakMap()
  #layers: Layers | undefined
  #defaultRouter: FlowEdgeRouter | undefined
  #scene: FlowScene | undefined
  #viewport: Viewport = DEFAULT_VIEWPORT
  #autoFit = true
  #fitPending = true
  #pan: PointerSession | undefined
  #suppressClick = false
  #resizeObserver: ResizeObserver | undefined

  override connectedCallback(): void {
    super.connectedCallback()
    const layers = this.#ensureLayers()
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver ??= new ResizeObserver(() => this.#onResize())
      this.#resizeObserver.observe(layers.root)
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resizeObserver?.disconnect()
    this.#pan?.dispose()
    this.#pan = undefined
    this.#layers?.root.removeAttribute('data-panning')
  }

  /** 定义从无到有时重新开启自动适配；extensions 赋值时当场合并查重，冲突时退回原值再抛。 */
  override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
    if (name === 'extensions') {
      try {
        createFlowRuntimeModel(this.extensions)
      }
      catch (error) {
        this.extensions = oldValue as readonly FlowRuntimeExtension[] | undefined
        throw error
      }
    }
    if (name === 'schema' && oldValue === undefined && this.schema !== undefined)
      this.#startAutoFit()
    super.requestUpdate(name, oldValue)
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    const layers = this.#ensureLayers()
    const t = this.#config.translations<FlowViewerTranslations>('xh-flow-viewer', DEFAULT_TRANSLATIONS, this.translations)
    layers.root.setAttribute('aria-label', t.label)
    if (!this.#scene || changed.has('schema') || changed.has('extensions') || changed.has('router'))
      this.#scene = this.schema ? buildScene(this.schema, this.#model().nodeTypes, { route: this.#route() }) : undefined
    this.#renderEdges(layers)
    this.#renderLabels(layers)
    this.#renderNodes(layers)
    if (!this.#fitIfPending())
      this.#applyViewport(false)
  }

  /** 当前视口。 */
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

  /** 以视口中心放大一档。 */
  zoomIn(): void {
    this.#zoomAtCenter(ZOOM_STEP)
  }

  /** 以视口中心缩小一档。 */
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

  /** 把节点居中显示。 */
  scrollToNode(id: string): void {
    const rect = this.#nodeRect(id)
    const size = this.#size()
    if (!rect || !size)
      return
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

  /** 设置单个节点的运行状态，传 null 清除。 */
  setNodeStatus(id: string, status: FlowNodeStatus | null): void {
    this.statuses = { ...this.statuses, [id]: status }
  }

  /** 批量设置节点运行状态，未列出的节点保持不变。 */
  setNodeStatuses(statuses: Readonly<Record<string, FlowNodeStatus | null>>): void {
    this.statuses = { ...this.statuses, ...statuses }
  }

  /** 高亮一组节点，其余节点取消高亮。 */
  highlightNodes(ids: readonly string[]): void {
    this.highlighted = [...ids]
  }

  /** 清除全部高亮。 */
  clearHighlights(): void {
    this.highlighted = []
  }

  #route(): FlowEdgeRouter {
    if (this.router)
      return this.router
    this.#defaultRouter ??= createOrthogonalRouter()
    return this.#defaultRouter
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
    const edges = doc.createElementNS(SVG_NS, 'svg')
    edges.setAttribute(GEN_ATTR, '')
    edges.setAttribute('data-part', 'edges')
    edges.setAttribute('aria-hidden', 'true')
    const labels = createGeneratedElement(doc, 'div')
    labels.dataset.part = 'labels'
    const nodes = createGeneratedElement(doc, 'div')
    nodes.dataset.part = 'nodes'
    world.append(edges, labels, nodes)
    root.append(world)
    this.append(root)
    root.addEventListener('pointerdown', this.#onPointerDown)
    root.addEventListener('click', this.#onClick)
    root.addEventListener('contextmenu', this.#onContextMenu)
    root.addEventListener('wheel', this.#onWheel, { passive: false })
    root.addEventListener('keydown', this.#onKeyDown)
    this.#layers = { root, world, edges, labels, nodes }
    return this.#layers
  }

  #renderEdges(layers: Layers): void {
    const scene = this.#scene
    const edges = scene?.edges.filter(edge => edge.path !== '') ?? []
    const box = scene?.bounds ? expandRect(scene.bounds, EDGE_LAYER_MARGIN) : { x: 0, y: 0, width: 0, height: 0 }
    const svg = layers.edges
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
    svg.setAttribute('width', String(box.width))
    svg.setAttribute('height', String(box.height))
    svg.style.left = `${box.x}px`
    svg.style.top = `${box.y}px`
    const doc = this.ownerDocument
    reconcile(svg, edges, this.#keys, edge => edge.id, (edge, reuse) => {
      const group = reuse ?? createEdgeGroup(doc)
      paintEdge(group, edge)
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

  #renderNodes(layers: Layers): void {
    const nodes = this.#scene?.nodes ?? []
    const statuses = this.statuses ?? {}
    const highlighted = new Set(this.highlighted ?? [])
    const doc = this.ownerDocument
    reconcile(layers.nodes, nodes, this.#keys, node => node.id, (sceneNode, reuse) => {
      const element = (reuse as HTMLElement | undefined) ?? createGeneratedElement(doc, 'div')
      this.#paintNode(element, sceneNode, statuses[sceneNode.id] ?? undefined, highlighted.has(sceneNode.id))
      return element
    })
  }

  #paintNode(element: HTMLElement, sceneNode: FlowSceneNode, status: FlowNodeStatus | undefined, highlighted: boolean): void {
    const { node, rect } = sceneNode
    element.dataset.part = 'node'
    element.dataset.nodeId = node.id
    element.dataset.nodeType = node.type
    toggleData(element, 'status', status)
    toggleData(element, 'highlighted', highlighted ? '' : undefined)
    element.style.left = `${rect.x}px`
    element.style.top = `${rect.y}px`
    element.style.width = `${rect.width}px`
    element.style.height = `${rect.height}px`
    const render = this.#model().renderers.get(node.type) ?? defaultNodeRenderer
    render(element, { node, nodeType: sceneNode.nodeType, label: sceneNode.label, status, highlighted })
  }

  #model(): FlowRuntimeModel {
    return createFlowRuntimeModel(this.extensions)
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

  #nodeRect(id: string): FlowRect | undefined {
    return this.#scene?.nodes.find(node => node.id === id)?.rect
  }

  #zoomAtCenter(factor: number): void {
    const size = this.#size()
    if (!size)
      return
    this.setViewport(zoomBy(this.#viewport, factor, { x: size.width / 2, y: size.height / 2 }))
  }

  #localPoint(event: MouseEvent): { x: number, y: number } {
    const box = this.#layers!.root.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
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

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#pan)
      return
    this.#stopAutoFit()
    this.#suppressClick = false
    const root = this.#layers!.root
    const start = { x: event.clientX, y: event.clientY }
    let last = start
    let panning = false
    this.#pan = createPointerSession({
      doc: resolveSessionDoc(this),
      pointerId: event.pointerId,
      onMove: ({ point }) => {
        if (!panning) {
          if (!shouldActivate({ x: point.clientX - start.x, y: point.clientY - start.y }))
            return
          panning = true
          root.setAttribute('data-panning', '')
        }
        const dx = point.clientX - last.x
        const dy = point.clientY - last.y
        last = { x: point.clientX, y: point.clientY }
        this.setViewport(panBy(this.#viewport, dx, dy))
      },
      onEnd: () => {
        this.#pan?.dispose()
        this.#pan = undefined
        this.#suppressClick = panning
        root.removeAttribute('data-panning')
      },
    })
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.#suppressClick) {
      this.#suppressClick = false
      return
    }
    const target = this.#targetOf(event)
    if (!target)
      emitEvent(this, 'blank-click', {})
    else
      emitEvent(this, target.kind === 'node' ? 'node-click' : 'edge-click', { id: target.id })
  }

  readonly #onContextMenu = (event: MouseEvent): void => {
    const target = this.#targetOf(event)
    const position = { x: event.clientX, y: event.clientY }
    const proceed = target
      ? emitEvent(this, `${target.kind}-contextmenu`, { id: target.id, ...position }, { cancelable: true })
      : emitEvent(this, 'blank-contextmenu', position, { cancelable: true })
    if (!proceed)
      event.preventDefault()
  }

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      this.setViewport(zoomBy(this.#viewport, wheelZoomFactor(event.deltaY, event.deltaMode), this.#localPoint(event)))
      return
    }
    const pixels = wheelPixels(event, { page: this.#size()?.height })
    this.setViewport(panBy(this.#viewport, -pixels.x, -pixels.y))
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey)
      return
    switch (event.key) {
      case '+':
      case '=':
        this.zoomIn()
        break
      case '-':
        this.zoomOut()
        break
      case '0':
        this.zoomToFit()
        break
      case 'ArrowLeft':
        this.setViewport(panBy(this.#viewport, PAN_STEP, 0))
        break
      case 'ArrowRight':
        this.setViewport(panBy(this.#viewport, -PAN_STEP, 0))
        break
      case 'ArrowUp':
        this.setViewport(panBy(this.#viewport, 0, PAN_STEP))
        break
      case 'ArrowDown':
        this.setViewport(panBy(this.#viewport, 0, -PAN_STEP))
        break
      default:
        return
    }
    event.preventDefault()
  }
}

/** 注册 <xh-flow-viewer> 与内置节点渲染用到的 <xh-icon>；重复调用不报错。 */
export function defineFlowViewer(): void {
  defineXhElement('xh-icon', XhIconElement)
  registerElement(FLOW_VIEWER_TAG, XhFlowViewer)
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

function paintEdge(group: Element, edge: FlowSceneEdge): void {
  group.setAttribute('data-edge-id', edge.id)
  if (edge.dashed)
    group.setAttribute('data-dashed', '')
  else
    group.removeAttribute('data-dashed')
  const [hit, line, arrow] = Array.from(group.children)
  hit!.setAttribute('d', edge.path)
  line!.setAttribute('d', edge.path)
  arrow!.setAttribute('d', edge.arrow)
}

function toggleData(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined)
    delete element.dataset[key]
  else
    element.dataset[key] = value
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-flow-viewer': XhFlowViewer
  }
}
