/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 受理人规则的编辑器由宿主提供：这里写成 JSON 文本框，失焦时解析写入，解析不了时标为无效、不写入。
// 实际的宿主一般换成从自己的用户、角色数据里挑选的控件。

import type { FlowDesignerExtension, FlowPropertyEditor } from '@xihan-flow/designer'
import { XIHAN_WORKFLOW_ASSIGNEE_RULES } from '@xihan-flow/core/presets/xihan-workflow'

// #region editor
const assigneeRulesEditor: FlowPropertyEditor = (initial) => {
  const input = document.createElement('textarea')
  input.rows = 3
  input.setAttribute('aria-label', initial.descriptor.label ?? '')
  let context = initial
  input.addEventListener('change', () => {
    try {
      context.setValue(input.value.trim() === '' ? undefined : JSON.parse(input.value))
      input.removeAttribute('aria-invalid')
      context.commit()
    }
    catch {
      input.setAttribute('aria-invalid', 'true')
    }
  })
  const update = (next: typeof initial): void => {
    context = next
    if (document.activeElement !== input)
      input.value = next.value === undefined ? '' : JSON.stringify(next.value)
    input.readOnly = next.readonly
  }
  update(initial)
  return { element: input, update }
}

export const assigneeRules: FlowDesignerExtension = {
  id: '@example/assignee-rules',
  editors: { byControl: { [XIHAN_WORKFLOW_ASSIGNEE_RULES]: assigneeRulesEditor } },
}
// #endregion editor
