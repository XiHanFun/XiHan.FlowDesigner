/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 查看器：高亮走过的路径、定位到某个节点，点节点时在状态行里显示它的名称与类型。

import type { FlowViewerEventMap } from '@xihan-flow/runtime'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { extensions, schema } from '../schemas/approval'

defineFlowViewer()

function button(text: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = text
  element.addEventListener('click', onClick)
  return element
}

export function mount(host: HTMLElement): () => void {
  const viewer = document.createElement('xh-flow-viewer')
  viewer.extensions = extensions
  viewer.schema = schema
  const status = document.createElement('p')
  status.textContent = '点一个节点看看'

  // #region highlight
  const highlight = button('高亮大额路径', () => viewer.highlightNodes(['start', 'dept', 'amount', 'gm', 'approved']))
  const clear = button('清除高亮', () => viewer.clearHighlights())
  // #endregion highlight

  // #region locate
  const locate = button('定位到总经理审批', () => viewer.scrollToNode('gm'))
  const fit = button('适配', () => viewer.zoomToFit())
  // #endregion locate

  // #region events
  viewer.addEventListener('node-click', (event) => {
    const { id } = (event as FlowViewerEventMap['node-click']).detail
    const node = schema.nodes.find(item => item.id === id)
    status.textContent = `点了「${node?.label}」，类型 ${node?.type}`
  })
  viewer.addEventListener('node-contextmenu', (event) => {
    // 取消后浏览器的右键菜单不出现，宿主可以在 detail 的 x、y 处弹自己的菜单
    event.preventDefault()
    status.textContent = `在「${(event as FlowViewerEventMap['node-contextmenu']).detail.id}」上按了右键`
  })
  // #endregion events

  host.append(highlight, clear, locate, fit, status, viewer)
  return () => host.replaceChildren()
}
