/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的小地图：画布右下角按比例画出全部节点、连线与当前视口的范围，在上面按下或拖动即把视口中心移过去。

import type { FlowPoint, FlowRect } from '@xihan-flow/core'
import type { FlowScene } from '@xihan-flow/runtime'
import type { Viewport } from '@xihan-ui/designer-kit'
import { fitRect, screenToWorld, unionRects, visibleWorldRect } from '@xihan-ui/designer-kit'
import { createPointerSession, resolveSessionDoc } from '@xihan-ui/pointer'
import { createGeneratedElement, SVG_NS } from '@xihan-ui/web-components/authoring'

/** 小地图四周留出的像素。 */
const PADDING = 6
/** 小地图能缩到的最小比例。 */
const MIN_ZOOM = 1e-4

/** 小地图需要设计器提供的能力。 */
export interface MinimapHost {
  readonly ownerDocument: Document
  readonly scene: () => FlowScene | undefined
  readonly viewport: () => Viewport
  /** 画布的屏幕尺寸，未布局时为 undefined。 */
  readonly canvasSize: () => { width: number, height: number } | undefined
  /** 把视口中心移到世界坐标处。 */
  readonly centerAt: (point: FlowPoint) => void
}

/** 小地图：场景变化时重画节点与连线，视口变化时只挪视口框。 */
export class MinimapPanel {
  readonly element: HTMLElement
  readonly #host: MinimapHost
  readonly #svg: SVGSVGElement
  readonly #world: SVGGElement
  readonly #frame: SVGRectElement
  #scene: FlowScene | undefined
  #map: Viewport | undefined
  /** 拖动中比例与位置保持不变，免得视口框跟着自己移动的视口来回跳。 */
  #dragging = false

  constructor(host: MinimapHost) {
    this.#host = host
    const doc = host.ownerDocument
    this.element = createGeneratedElement(doc, 'div')
    this.element.dataset.part = 'minimap'
    this.element.setAttribute('aria-hidden', 'true')
    this.#svg = doc.createElementNS(SVG_NS, 'svg')
    this.#world = doc.createElementNS(SVG_NS, 'g')
    this.#frame = doc.createElementNS(SVG_NS, 'rect')
    this.#frame.setAttribute('data-part', 'minimap-frame')
    this.#svg.append(this.#frame, this.#world)
    this.element.append(this.#svg)
    this.element.addEventListener('pointerdown', this.#onPointerDown)
  }

  /** 场景或视口变化后重画；没有节点时收起。 */
  update(): void {
    const scene = this.#host.scene()
    const size = { width: this.element.clientWidth, height: this.element.clientHeight }
    const canvas = this.#host.canvasSize()
    this.element.hidden = !scene?.bounds
    if (!scene?.bounds || size.width === 0 || size.height === 0)
      return
    const visible = canvas ? visibleWorldRect(this.#host.viewport(), canvas) : undefined
    if (!this.#dragging || !this.#map) {
      const bounds = unionRects(visible ? [scene.bounds, visible] : [scene.bounds])!
      this.#map = fitRect(bounds, size, { padding: PADDING, maxZoom: 1, limits: { min: MIN_ZOOM, max: 1 } })
    }
    const { x, y, zoom } = this.#map
    this.#world.setAttribute('transform', `translate(${x} ${y}) scale(${zoom})`)
    if (scene !== this.#scene) {
      this.#scene = scene
      this.#draw(scene)
    }
    this.#placeFrame(visible)
  }

  #draw(scene: FlowScene): void {
    const doc = this.#host.ownerDocument
    const shapes: SVGElement[] = []
    for (const edge of scene.edges) {
      if (edge.path === '')
        continue
      const path = doc.createElementNS(SVG_NS, 'path')
      path.setAttribute('data-part', 'minimap-edge')
      path.setAttribute('d', edge.path)
      shapes.push(path)
    }
    for (const node of scene.nodes) {
      const rect = doc.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('data-part', 'minimap-node')
      setRect(rect, node.rect)
      shapes.push(rect)
    }
    this.#world.replaceChildren(...shapes)
  }

  #placeFrame(visible: FlowRect | undefined): void {
    const map = this.#map
    this.#frame.style.display = visible && map ? '' : 'none'
    if (!visible || !map)
      return
    setRect(this.#frame, {
      x: visible.x * map.zoom + map.x,
      y: visible.y * map.zoom + map.y,
      width: visible.width * map.zoom,
      height: visible.height * map.zoom,
    })
  }

  #worldAt(clientX: number, clientY: number): FlowPoint | undefined {
    const map = this.#map
    if (!map)
      return undefined
    const box = this.element.getBoundingClientRect()
    return screenToWorld(map, { x: clientX - box.left, y: clientY - box.top })
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0)
      return
    event.preventDefault()
    const move = (clientX: number, clientY: number): void => {
      const point = this.#worldAt(clientX, clientY)
      if (point)
        this.#host.centerAt(point)
    }
    this.#dragging = true
    move(event.clientX, event.clientY)
    const session = createPointerSession({
      doc: resolveSessionDoc(this.element),
      pointerId: event.pointerId,
      onMove: ({ point }) => move(point.clientX, point.clientY),
      onEnd: () => {
        session.dispose()
        this.#dragging = false
        this.update()
      },
    })
  }
}

function setRect(element: SVGRectElement, rect: FlowRect): void {
  element.setAttribute('x', String(rect.x))
  element.setAttribute('y', String(rect.y))
  element.setAttribute('width', String(rect.width))
  element.setAttribute('height', String(rect.height))
}
