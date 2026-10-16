/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 属性面板的内建编辑器：七种内建编辑方式各用一个 UI 字段元素，标签写在元素自己的 label 部件里。

import type { FlowEdge, FlowNode, FlowPropertyDescriptor } from '@xihan-flow/core'
import type { JsonValue } from '@xihan-ui/core/json'
import type { PropertyControl, PropertyEditor, PropertyEditorContext, PropertyEditorInstance, PropertyOption } from '@xihan-ui/designer-kit/properties'
import { jsonEquals } from '@xihan-ui/core/json'
import { createAuthoredElement, setText } from '@xihan-ui/web-components/authoring'

/** 属性面板编辑的对象：节点或连线。 */
export type FlowPropertyTarget = FlowNode | FlowEdge

/** 交给属性编辑器的上下文。 */
export type FlowPropertyEditorContext = PropertyEditorContext<FlowPropertyDescriptor, FlowPropertyTarget>

/** 属性编辑器实例。 */
export type FlowPropertyEditorInstance = PropertyEditorInstance<FlowPropertyDescriptor, FlowPropertyTarget>

/** 宿主提供的属性编辑器。 */
export type FlowPropertyEditor = PropertyEditor<FlowPropertyDescriptor, FlowPropertyTarget>

/** 内建编辑器在通用上下文之外拿到的字段状态。 */
export interface FieldContext extends FlowPropertyEditorContext {
  readonly ownerDocument: Document
  readonly label: string
  readonly required: boolean
  readonly invalid: boolean
  /** JSON 编辑框里的文字不合法时的提示。 */
  readonly invalidJson: string
  /** 报告编辑框自己发现的错误（如文字不是 JSON），undefined 表示没有。 */
  readonly setLocalError: (message: string | undefined) => void
}

interface FieldInstance {
  readonly element: HTMLElement
  readonly update: (context: FieldContext) => void
}

type FieldEditor = (context: FieldContext) => FieldInstance

/** UI 字段元素上受控的值与状态。 */
interface FieldElement extends HTMLElement {
  value?: unknown
  checked?: boolean
  autoSize?: unknown
}

type ValueChange<T> = CustomEvent<{ value: T }>

const EDITORS: Readonly<Record<PropertyControl['kind'], FieldEditor>> = {
  text: textEditor,
  number: numberEditor,
  boolean: booleanEditor,
  select: selectEditor,
  tags: tagsEditor,
  color: colorEditor,
  json: jsonEditor,
}

/** 按编辑方式取内建编辑器；不是内建种类时为 undefined。 */
export function builtinEditor(kind: string): FieldEditor | undefined {
  return Object.hasOwn(EDITORS, kind) ? EDITORS[kind as PropertyControl['kind']] : undefined
}

function controlOf<K extends PropertyControl['kind']>(context: FieldContext): Extract<PropertyControl, { kind: K }> {
  return context.descriptor.control as Extract<PropertyControl, { kind: K }>
}

/** 字段元素的只读、必填与无效状态。 */
function applyState(field: HTMLElement, context: FieldContext): void {
  field.toggleAttribute('read-only', context.readonly)
  field.toggleAttribute('required', context.required)
  field.toggleAttribute('invalid', context.invalid)
}

function textOf(value: JsonValue | undefined): string {
  if (value === undefined || value === null)
    return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function labelPart(doc: Document, tag: 'label' | 'span', text: string): HTMLElement {
  return createAuthoredElement(doc, tag, { 'data-xh-part': 'label' }, [text])
}

function textEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const control = controlOf<'text'>(initial)
  const label = labelPart(doc, 'label', initial.label)
  const input = createAuthoredElement(doc, control.multiline ? 'textarea' : 'input', { 'data-xh-part': 'input' })
  const field: FieldElement = createAuthoredElement(doc, 'xh-text-field', { size: 'sm', placeholder: control.placeholder }, [
    createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [label, createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, [input])]),
  ])
  if (control.multiline)
    field.autoSize = { minRows: 2, maxRows: 6 }
  let context = initial
  field.addEventListener('value-change', (event) => {
    const { value } = (event as ValueChange<string>).detail
    field.value = value
    context.setValue(value === '' ? undefined : value)
  })
  field.addEventListener('focusout', () => context.commit())
  const update = (next: FieldContext): void => {
    context = next
    setText(label, next.label)
    const value = textOf(next.value)
    if (field.value !== value)
      field.value = value
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}

function numberEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const control = controlOf<'number'>(initial)
  const label = labelPart(doc, 'label', initial.label)
  const parts: HTMLElement[] = [createAuthoredElement(doc, 'button', { 'data-xh-part': 'decrement-trigger', 'type': 'button' }), createAuthoredElement(doc, 'input', { 'data-xh-part': 'input' })]
  if (control.unit !== undefined)
    parts.push(createAuthoredElement(doc, 'span', { 'data-xh-part': 'suffix' }, [control.unit]))
  parts.push(createAuthoredElement(doc, 'button', { 'data-xh-part': 'increment-trigger', 'type': 'button' }))
  const field: FieldElement = createAuthoredElement(doc, 'xh-number-field', {
    size: 'sm',
    min: control.min,
    max: control.max,
    step: control.step ?? (control.integer ? 1 : undefined),
  }, [createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [label, createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, parts)])])
  let context = initial
  field.addEventListener('value-change', (event) => {
    const { value, valueAsNumber } = (event as CustomEvent<{ value: string, valueAsNumber: number }>).detail
    field.value = value
    if (value.trim() === '')
      context.setValue(undefined)
    else if (Number.isFinite(valueAsNumber))
      context.setValue(valueAsNumber)
  })
  field.addEventListener('focusout', () => context.commit())
  const update = (next: FieldContext): void => {
    context = next
    setText(label, next.label)
    const shown = typeof field.value === 'string' ? field.value : ''
    const same = next.value === undefined ? shown.trim() === '' : shown.trim() !== '' && Number(shown) === next.value
    if (!same)
      field.value = textOf(next.value)
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}

function booleanEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const text = createAuthoredElement(doc, 'span', { 'data-xh-part': 'text' }, [initial.label])
  const field: FieldElement = createAuthoredElement(doc, 'xh-switch', { size: 'sm' }, [
    createAuthoredElement(doc, 'label', { 'data-xh-part': 'label' }, [
      createAuthoredElement(doc, 'button', { 'data-xh-part': 'root', 'type': 'button' }, [createAuthoredElement(doc, 'span', { 'data-xh-part': 'thumb' })]),
      text,
    ]),
  ])
  let context = initial
  field.addEventListener('checked-change', (event) => {
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail
    field.checked = checked
    context.setValue(checked)
    context.commit()
  })
  const update = (next: FieldContext): void => {
    context = next
    setText(text, next.label)
    const checked = next.value === true
    if (field.checked !== checked)
      field.checked = checked
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}

function selectEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const control = controlOf<'select'>(initial)
  const options: readonly PropertyOption[] = control.options
  const label = labelPart(doc, 'span', initial.label)
  const box: HTMLElement[] = [createAuthoredElement(doc, 'button', { 'data-xh-part': 'trigger', 'type': 'button' }, [
    createAuthoredElement(doc, 'span', { 'data-xh-part': 'value-text' }),
    createAuthoredElement(doc, 'span', { 'data-xh-part': 'indicator' }),
  ])]
  if (!initial.required)
    box.push(createAuthoredElement(doc, 'button', { 'data-xh-part': 'clear-trigger', 'type': 'button' }))
  const items = options.map((option, index) => createAuthoredElement(doc, 'div', { 'data-xh-part': 'item', 'value': String(index) }, [
    createAuthoredElement(doc, 'span', { 'data-xh-part': 'item-text' }, [option.label ?? String(option.value)]),
    createAuthoredElement(doc, 'span', { 'data-xh-part': 'item-indicator' }),
  ]))
  const field: FieldElement = createAuthoredElement(doc, 'xh-select', { size: 'sm', multiple: control.multiple === true }, [
    createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [
      label,
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, box),
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'positioner' }, [createAuthoredElement(doc, 'div', { 'data-xh-part': 'content' }, [createAuthoredElement(doc, 'div', { 'data-xh-part': 'list' }, items)])]),
    ]),
  ])
  const keysOf = (value: JsonValue | undefined): string[] => {
    const values = control.multiple ? (Array.isArray(value) ? value : []) : value === undefined ? [] : [value]
    return values.flatMap((item) => {
      const index = options.findIndex(option => option.value === item)
      return index < 0 ? [] : [String(index)]
    })
  }
  let context = initial
  field.addEventListener('value-change', (event) => {
    const keys = (event as ValueChange<string[]>).detail.value
    field.value = keys
    const values = keys.map(key => options[Number(key)]!.value)
    if (control.multiple)
      context.setValue(values.length === 0 ? undefined : values)
    else
      context.setValue(values[0])
    context.commit()
  })
  const update = (next: FieldContext): void => {
    context = next
    setText(label, next.label)
    const keys = keysOf(next.value)
    const current = Array.isArray(field.value) ? field.value as string[] : []
    if (current.length !== keys.length || current.some((key, index) => key !== keys[index]))
      field.value = keys
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}

function tagsEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const label = labelPart(doc, 'label', initial.label)
  const input = createAuthoredElement(doc, 'input', { 'data-xh-part': 'input' })
  const box = createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, [input])
  const field: FieldElement = createAuthoredElement(doc, 'xh-tags-input', { size: 'sm' }, [createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [label, box])])
  const render = (tags: readonly string[]): void => {
    const alive = new Map<string, Element>()
    for (const item of Array.from(box.querySelectorAll('[data-xh-part="item"]')))
      alive.set(item.getAttribute('value') ?? '', item)
    for (const [value, item] of alive) {
      if (!tags.includes(value))
        item.remove()
    }
    for (const tag of tags) {
      if (alive.has(tag))
        continue
      box.insertBefore(createAuthoredElement(doc, 'div', { 'data-xh-part': 'item', 'value': tag }, [
        createAuthoredElement(doc, 'div', { 'data-xh-part': 'item-preview' }, [
          createAuthoredElement(doc, 'span', { 'data-xh-part': 'item-text' }, [tag]),
          createAuthoredElement(doc, 'button', { 'data-xh-part': 'item-delete-trigger', 'type': 'button' }),
        ]),
      ]), input)
    }
  }
  const tagsOf = (value: JsonValue | undefined): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  let context = initial
  field.addEventListener('value-change', (event) => {
    const tags = (event as ValueChange<string[]>).detail.value
    field.value = tags
    render(tags)
    context.setValue(tags.length === 0 ? undefined : tags)
    context.commit()
  })
  const update = (next: FieldContext): void => {
    context = next
    setText(label, next.label)
    const tags = tagsOf(next.value)
    const current = Array.isArray(field.value) ? field.value as string[] : []
    if (current.length !== tags.length || current.some((tag, index) => tag !== tags[index])) {
      field.value = tags
      render(tags)
    }
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}

function colorEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const label = labelPart(doc, 'label', initial.label)
  const box: HTMLElement[] = [createAuthoredElement(doc, 'span', { 'data-xh-part': 'swatch' }), createAuthoredElement(doc, 'input', { 'data-xh-part': 'input' })]
  if (!initial.required)
    box.push(createAuthoredElement(doc, 'button', { 'data-xh-part': 'clear-trigger', 'type': 'button' }))
  const field: FieldElement = createAuthoredElement(doc, 'xh-color-field', { size: 'sm', placeholder: '#rrggbb' }, [
    createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [label, createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, box)]),
  ])
  let context = initial
  field.addEventListener('value-change', (event) => {
    const { value } = (event as ValueChange<string>).detail
    field.value = value
    context.setValue(value === '' ? undefined : value)
    context.commit()
  })
  const update = (next: FieldContext): void => {
    context = next
    setText(label, next.label)
    const value = typeof next.value === 'string' ? next.value : ''
    if (field.value !== value)
      field.value = value
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}

function jsonEditor(initial: FieldContext): FieldInstance {
  const doc = initial.ownerDocument
  const label = labelPart(doc, 'label', initial.label)
  const field: FieldElement = createAuthoredElement(doc, 'xh-text-field', { size: 'sm' }, [
    createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [label, createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, [createAuthoredElement(doc, 'textarea', { 'data-xh-part': 'input', 'spellcheck': 'false' })])]),
  ])
  field.autoSize = { minRows: 3, maxRows: 10 }
  field.dataset.json = ''
  const format = (value: JsonValue | undefined): string => value === undefined ? '' : JSON.stringify(value, null, 2)
  const parse = (text: string): { ok: true, value: JsonValue | undefined } | { ok: false } => {
    if (text.trim() === '')
      return { ok: true, value: undefined }
    try {
      return { ok: true, value: JSON.parse(text) as JsonValue }
    }
    catch {
      return { ok: false }
    }
  }
  let context = initial
  // 上一次从定义里读到的值：没变就保留框里的文字（哪怕还不是合法 JSON），变了才按新值重写
  let seen = initial.value
  field.value = format(initial.value)
  field.addEventListener('value-change', (event) => {
    const { value } = (event as ValueChange<string>).detail
    field.value = value
    const parsed = parse(value)
    if (parsed.ok) {
      context.setLocalError(undefined)
      context.setValue(parsed.value)
    }
    else {
      context.setLocalError(context.invalidJson)
    }
  })
  field.addEventListener('focusout', () => context.commit())
  const update = (next: FieldContext): void => {
    context = next
    setText(label, next.label)
    if (!jsonEquals(next.value, seen)) {
      seen = next.value
      const shown = parse(typeof field.value === 'string' ? field.value : '')
      if (!shown.ok || !jsonEquals(shown.value, next.value)) {
        field.value = format(next.value)
        next.setLocalError(undefined)
      }
    }
    applyState(field, next)
  }
  update(initial)
  return { element: field, update }
}
