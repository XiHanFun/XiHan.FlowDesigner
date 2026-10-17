/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 自定义节点内容：审批节点在名称下面列出处理人，其余节点照常显示名称。

import type { FlowRuntimeExtension } from '@xihan-flow/runtime'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { schema, workflow } from '../schemas/approval'

defineFlowViewer()

// #region renderer
const assignees: FlowRuntimeExtension = {
  id: 'example/assignees',
  nodeRenderers: {
    UserTask: (container, { node, label }) => {
      const properties = node.data?.properties as { Assignees?: string[] } | undefined
      const title = document.createElement('strong')
      title.textContent = label
      const people = document.createElement('small')
      people.textContent = (properties?.Assignees ?? []).join('、')
      container.replaceChildren(title, document.createElement('br'), people)
    },
  },
}
// #endregion renderer

export function mount(host: HTMLElement): () => void {
  // #region use
  const viewer = document.createElement('xh-flow-viewer')
  viewer.extensions = [workflow, assignees]
  viewer.schema = schema
  // #endregion use
  host.append(viewer)
  return () => host.replaceChildren()
}
