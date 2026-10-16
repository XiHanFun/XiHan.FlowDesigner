/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 宿主自定义的属性编辑器示例：条件表达式用 UI 的多行文本框编辑，连续输入并成一步撤销，失焦时封口。

import type { FlowPropertyEditor } from '@xihan-flow/designer'

interface TextField extends HTMLElement {
  value?: string
}

export const expressionEditor: FlowPropertyEditor = (initial) => {
  const input = document.createElement('textarea')
  input.dataset.xhPart = 'input'
  input.spellcheck = false
  input.setAttribute('aria-label', initial.descriptor.label ?? '')
  const control = document.createElement('div')
  control.dataset.xhPart = 'control'
  control.append(input)
  const root = document.createElement('div')
  root.dataset.xhPart = 'root'
  root.append(control)
  const field = document.createElement('xh-text-field') as TextField
  field.setAttribute('size', 'sm')
  field.setAttribute('placeholder', 'amount > 10000')
  field.append(root)

  let context = initial
  field.addEventListener('value-change', (event) => {
    const { value } = (event as CustomEvent<{ value: string }>).detail
    field.value = value
    context.setValue(value === '' ? undefined : value)
  })
  field.addEventListener('focusout', () => context.commit())

  const update: NonNullable<ReturnType<FlowPropertyEditor>['update']> = (next) => {
    context = next
    const value = typeof next.value === 'string' ? next.value : ''
    if (field.value !== value)
      field.value = value
    field.toggleAttribute('read-only', next.readonly)
  }
  update(initial)
  return { element: field, update }
}
