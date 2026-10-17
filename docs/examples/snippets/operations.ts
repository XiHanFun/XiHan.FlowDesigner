/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 编辑操作：改名、挪位置，再用逆操作撤回。

// #region example
import { applyOperations } from '@xihan-flow/core'
import { schema } from '../schemas/approval'

const { document, inverse } = applyOperations(schema, [
  { type: 'updateNode', id: 'gm', patch: { label: '总经理与财务审批' } },
  { type: 'moveNodes', positions: [{ id: 'gm', x: 624, y: 0 }] },
])

// 按顺序应用逆操作，回到修改之前
const restored = applyOperations(document, inverse).document
// #endregion example

export { document, restored }
