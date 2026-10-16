/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的小地图：把场景里的节点与连线交给 <xh-designer-minimap>，在上面按下或拖动即把视口中心移过去。

import type { FlowPoint } from '@xihan-flow/core'
import type { FlowScene } from '@xihan-flow/runtime'
import type { Viewport } from '@xihan-ui/designer-kit'
import type { DesignerMinimapEventMap, DesignerMinimapShape, XhDesignerMinimapElement } from '@xihan-ui/designer-shell'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'

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

/** 小地图：场景变化时换图形，视口与画布尺寸每次更新都交过去。 */
export class MinimapPanel {
  readonly element: XhDesignerMinimapElement
  readonly #host: MinimapHost
  #scene: FlowScene | undefined

  constructor(host: MinimapHost) {
    this.#host = host
    this.element = createGeneratedElement(host.ownerDocument, 'xh-designer-minimap', { 'data-part': 'minimap' })
    this.element.addEventListener('navigate', (event) => {
      host.centerAt((event as DesignerMinimapEventMap['navigate']).detail.center)
    })
  }

  update(): void {
    const scene = this.#host.scene()
    if (scene !== this.#scene) {
      this.#scene = scene
      const edges = (scene?.edges ?? []).filter(edge => edge.path !== '').map((edge): DesignerMinimapShape => ({ kind: 'path', d: edge.path }))
      const nodes = (scene?.nodes ?? []).map((node): DesignerMinimapShape => ({ kind: 'rect', rect: node.rect }))
      this.element.shapes = [...edges, ...nodes]
      this.element.bounds = scene?.bounds
    }
    this.element.viewport = this.#host.viewport()
    this.element.canvasSize = this.#host.canvasSize()
  }
}
