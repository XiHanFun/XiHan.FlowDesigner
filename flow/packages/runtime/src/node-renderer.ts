/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置的节点内容：查看器与设计器给没有登记渲染的节点类型画的内容。

import type { FlowNodeType } from '@xihan-flow/core'
import type { FlowNodeRenderContext } from './flow-viewer'
import { createAuthoredElement, SVG_NS } from '@xihan-ui/web-components/authoring'

type IconHost = HTMLElement & { icon?: FlowNodeType['icon'] }

/** 建一个 <xh-icon>：根 svg 与 glyph 部件由这里写好，记录交给元素铺进 glyph。 */
function createIcon(doc: Document): IconHost {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('data-xh-part', 'root')
  const glyph = doc.createElementNS(SVG_NS, 'g')
  glyph.setAttribute('data-xh-part', 'glyph')
  svg.append(glyph)
  return createAuthoredElement(doc, 'xh-icon', { 'size': 'sm', 'data-part': 'node-icon' }, [svg])
}

/**
 * 内置的节点内容：节点类型给了 icon 时图标（data-part="node-icon"）在前、文字（data-part="node-label"）在后，
 * 没给时节点里只有文字。没有登记渲染的节点类型用它，自定义的渲染也可以调它画出同样的内容。
 * 重画时复用已有的图标与文字节点。图标是 <xh-icon>，defineFlowViewer() 与 defineFlowDesigner() 会注册它。
 */
export function defaultNodeRenderer(container: HTMLElement, { nodeType, label }: FlowNodeRenderContext): void {
  const record = nodeType?.icon
  if (record === undefined) {
    if (container.childElementCount > 0 || container.textContent !== label)
      container.textContent = label
    return
  }
  const [first, second] = container.children
  const reusable = container.childNodes.length === 2 && first?.localName === 'xh-icon' && second instanceof HTMLElement && second.dataset.part === 'node-label'
  const icon = reusable ? first as IconHost : createIcon(container.ownerDocument)
  const text = reusable ? second : createAuthoredElement(container.ownerDocument, 'span', { 'data-part': 'node-label' })
  if (!reusable)
    container.replaceChildren(icon, text)
  if (icon.icon !== record)
    icon.icon = record
  if (text.textContent !== label)
    text.textContent = label
}
