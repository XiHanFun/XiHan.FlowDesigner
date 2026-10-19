/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 物料面板里多一组「常用片段」：点条目在视口中央、拖进画布在松手处放下一段两级审批。

import type { FlowClipboard, FlowDesignerExtension } from '@xihan-flow/designer'

const twoLevelApproval: FlowClipboard = {
  nodes: [
    { id: 'dept', type: 'approval', x: 0, y: 0, width: 140, height: 56, data: { name: '部门审批' } },
    { id: 'finance', type: 'approval', x: 220, y: 0, width: 140, height: 56, data: { name: '财务审批' } },
  ],
  edges: [{ id: 'next', source: { node: 'dept' }, target: { node: 'finance' } }],
}

// #region palette-sources
export const snippets: FlowDesignerExtension = {
  id: '@acme/flow-snippets',
  paletteSources: [{
    id: '@acme/flow-snippets.common',
    groups: () => [{
      id: '@acme/flow-snippets.common',
      label: '常用片段',
      items: [{ id: '@acme/flow-snippets.two-level-approval', label: '两级审批', description: '部门审批后转财务审批' }],
    }],
    insert: (_item, { designer }, at) => {
      designer.paste(twoLevelApproval, { at: at ?? designer.getViewportCenter() })
    },
  }],
}
// #endregion palette-sources
