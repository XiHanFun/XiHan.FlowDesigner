/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 扩展冲突：两个扩展登记了同一个节点类型，赋值当场抛 DesignerExtensionError，设计器保持原来的扩展。

import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { leave } from '../schemas/leave'

export function assign(designer: HTMLElementTagNameMap['xh-flow-designer']): void {
  // #region conflict
  const other = { id: '@example/other', nodeTypes: [{ type: 'approve', size: { width: 160, height: 48 }, ports: 'both' as const }] }
  try {
    designer.extensions = [leave, other]
  }
  catch (error) {
    if (!(error instanceof DesignerExtensionError))
      throw error
    // error.space 是 'node-type'，error.key 是 'approve'，error.extensions 是 ['@example/leave', '@example/other']
    console.warn(error.message)
  }
  // #endregion conflict
}
