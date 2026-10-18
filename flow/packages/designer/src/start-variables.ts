/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// XiHan 工作流预设的启动变量（XIHAN_WORKFLOW_START_VARIABLES）的内建编辑器：库内 xh-field-array 的表格排布，
// 一个变量一行，列是变量名、必填、缺省值与说明，可以增删。缺省值按 JSON 读写，写不成 JSON 时这一格标为无效、不写入；
// 变量上别的字段（如 type）原样保留。

import type { FlowDesignerTranslations, FlowStartVariableColumn } from '@xihan-flow/runtime'
import type { JsonObject, JsonValue } from '@xihan-ui/core/json'
import type { FlowPropertyEditor } from './panels/properties'
import { isPlainObject, jsonEquals } from '@xihan-ui/core/json'
import { createAuthoredElement, setText } from '@xihan-ui/web-components/authoring'

/** 启动变量编辑器从设计器取的东西。 */
export interface StartVariablesHost {
  readonly ownerDocument: () => Document
  readonly translations: () => FlowDesignerTranslations
}

const COLUMNS: readonly FlowStartVariableColumn[] = ['name', 'required', 'defaultValue', 'description']
/** 文字列的最小宽度（px）：窄面板里不再压窄到它以下，放不下时表格区横向滚动。必填列按表头与勾选框里最宽的那个排。 */
const TEXT_COLUMN_MIN_WIDTH = 120
/** 一行里各格控件的尺寸档：文本框与勾选框取同一档，勾选框的方框是这一档的指示符大小。 */
const CELL_SIZE = 'sm'

/** 库内字段元素上受控的值。 */
interface ControlElement extends HTMLElement {
  value?: unknown
  checked?: boolean
}

/** 字段数组上受控的数据、造行工厂与列。 */
interface FieldArrayElement extends HTMLElement {
  value?: unknown[]
  createItem?: () => unknown
  columns?: readonly { readonly id: string, readonly label?: string, readonly width?: string | number, readonly minWidth?: string | number }[]
}

type Parsed = { readonly ok: true, readonly value: JsonValue | undefined } | { readonly ok: false }

/** 缺省值格里的文字换成取值：空白是不写，其余按 JSON 读。 */
function parseDefault(text: string): Parsed {
  if (text.trim() === '')
    return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue }
  }
  catch {
    return { ok: false }
  }
}

function formatDefault(value: JsonValue | undefined): string {
  return value === undefined || value === null ? '' : JSON.stringify(value)
}

function textOf(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

function textField(doc: Document): ControlElement {
  return createAuthoredElement(doc, 'xh-text-field', { size: CELL_SIZE }, [
    createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'control' }, [createAuthoredElement(doc, 'input', { 'data-xh-part': 'input', 'spellcheck': 'false' })]),
    ]),
  ])
}

function checkbox(doc: Document): ControlElement {
  return createAuthoredElement(doc, 'xh-checkbox', { size: CELL_SIZE }, [
    createAuthoredElement(doc, 'button', { 'data-xh-part': 'root', 'type': 'button' }, [createAuthoredElement(doc, 'span', { 'data-xh-part': 'indicator' })]),
  ])
}

/** 一个变量换掉一个字段；undefined 即删掉这个字段。不是对象的那一项按空对象改。 */
function withField(variable: JsonValue | undefined, key: string, value: JsonValue | undefined): JsonObject {
  const next: Record<string, JsonValue> = { ...(isPlainObject(variable) ? variable : {}) }
  if (value === undefined)
    delete next[key]
  else
    next[key] = value
  return next
}

/** 建启动变量的编辑器；设计器把它登记在编辑方式 XIHAN_WORKFLOW_START_VARIABLES 下，宿主可以按种类换掉。 */
export function startVariablesEditor(host: StartVariablesHost): FlowPropertyEditor {
  return (initial) => {
    const doc = host.ownerDocument()
    const header = createAuthoredElement(doc, 'div', { 'data-xh-part': 'header' }, COLUMNS.map(column => createAuthoredElement(doc, 'div', { 'data-xh-part': 'column-header', 'value': column })))
    const table = createAuthoredElement(doc, 'div', { 'data-xh-part': 'table' }, [header])
    const add = createAuthoredElement(doc, 'button', { 'data-xh-part': 'add-trigger', 'type': 'button' })
    const list: FieldArrayElement = createAuthoredElement(doc, 'xh-field-array', { layout: 'table' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [table, add]),
    ])
    list.createItem = () => ({ name: '', required: false })

    let context = initial
    let variables: JsonValue[] = []
    /**
     * 每行上一次从取值里读到的缺省值：没变就保留格里的文字（哪怕还不是合法 JSON），变了才按新值重写。
     * 行按位置对应变量，行数一变各行对应的变量可能换了，记录全部作废。
     */
    let seenDefaults = new WeakMap<HTMLElement, JsonValue | undefined>()

    /** 每行各列的控件。 */
    const cells = new WeakMap<HTMLElement, Readonly<Record<FlowStartVariableColumn, ControlElement>>>()
    const rows = (): HTMLElement[] => Array.from(table.querySelectorAll<HTMLElement>(':scope > [data-xh-part="item"]'))
    const cell = (row: HTMLElement, column: FlowStartVariableColumn): ControlElement => cells.get(row)![column]

    const write = (next: JsonValue[]): void => {
      variables = next
      list.value = next
      context.setValue(next)
    }
    const writeField = (row: HTMLElement, key: string, value: JsonValue | undefined): void => {
      const index = rows().indexOf(row)
      if (index < 0 || index >= variables.length)
        return
      const next = [...variables]
      next[index] = withField(variables[index], key, value)
      write(next)
    }

    const createRow = (): HTMLElement => {
      const name = textField(doc)
      const required = checkbox(doc)
      const fallback = textField(doc)
      const description = textField(doc)
      const controls: Readonly<Record<FlowStartVariableColumn, ControlElement>> = { name, required, defaultValue: fallback, description }
      const row = createAuthoredElement(doc, 'div', { 'data-xh-part': 'item' }, [
        ...COLUMNS.map(column => createAuthoredElement(doc, 'div', { 'data-xh-part': 'item-cell', 'value': column }, [controls[column]])),
        createAuthoredElement(doc, 'div', { 'data-xh-part': 'item-action' }, [
          createAuthoredElement(doc, 'button', { 'data-xh-part': 'item-delete-trigger', 'type': 'button' }),
        ]),
      ])
      cells.set(row, controls)
      for (const [field, key] of [[name, 'name'], [description, 'description']] as const) {
        field.addEventListener('value-change', (event) => {
          event.stopPropagation()
          const text = (event as CustomEvent<{ value: string }>).detail.value
          field.value = text
          writeField(row, key, key === 'description' && text === '' ? undefined : text)
        })
      }
      required.addEventListener('checked-change', (event) => {
        event.stopPropagation()
        const { checked } = (event as CustomEvent<{ checked: boolean }>).detail
        required.checked = checked
        writeField(row, 'required', checked)
        context.commit()
      })
      fallback.addEventListener('value-change', (event) => {
        event.stopPropagation()
        const text = (event as CustomEvent<{ value: string }>).detail.value
        fallback.value = text
        const parsed = parseDefault(text)
        fallback.toggleAttribute('invalid', !parsed.ok)
        if (parsed.ok) {
          seenDefaults.set(row, parsed.value)
          writeField(row, 'defaultValue', parsed.value)
        }
      })
      return row
    }

    /** 表里的行数跟上取值，再把各格换成取值里的。 */
    const renderRows = (t: FlowDesignerTranslations): void => {
      let items = rows()
      if (items.length !== variables.length)
        seenDefaults = new WeakMap()
      while (items.length > variables.length)
        items.pop()!.remove()
      while (items.length < variables.length) {
        table.append(createRow())
        items = rows()
      }
      items.forEach((row, index) => {
        const variable = variables[index]
        const fields: JsonObject = isPlainObject(variable) ? variable : {}
        for (const column of COLUMNS) {
          const control = cell(row, column)
          const label = t.startVariableCell(index + 1, t.startVariableColumns[column])
          if (control.getAttribute('aria-label') !== label)
            control.setAttribute('aria-label', label)
          control.toggleAttribute('read-only', context.readonly)
        }
        const name = textOf(fields.name)
        if (cell(row, 'name').value !== name)
          cell(row, 'name').value = name
        const description = textOf(fields.description)
        if (cell(row, 'description').value !== description)
          cell(row, 'description').value = description
        const required = fields.required === true
        if (cell(row, 'required').checked !== required)
          cell(row, 'required').checked = required
        const fallback = cell(row, 'defaultValue')
        const value = fields.defaultValue ?? undefined
        if (!seenDefaults.has(row) || !jsonEquals(seenDefaults.get(row), value)) {
          seenDefaults.set(row, value)
          const shown = parseDefault(typeof fallback.value === 'string' ? fallback.value : '')
          if (!shown.ok || !jsonEquals(shown.value, value)) {
            fallback.value = formatDefault(value)
            fallback.removeAttribute('invalid')
          }
        }
      })
    }

    list.addEventListener('value-change', (event) => {
      if (event.target !== list)
        return
      event.stopPropagation()
      write([...(event as CustomEvent<{ value: JsonValue[] }>).detail.value])
      renderRows(host.translations())
      context.commit()
    })
    list.addEventListener('focusout', () => context.commit())

    const update = (next: typeof initial): void => {
      context = next
      const t = host.translations()
      const label = next.descriptor.label ?? ''
      if (list.getAttribute('aria-label') !== label)
        list.setAttribute('aria-label', label)
      const columns = COLUMNS.map(column => ({ id: column, label: t.startVariableColumns[column], ...(column === 'required' ? { width: 'max-content' } : { minWidth: TEXT_COLUMN_MIN_WIDTH }) }))
      if (!jsonEquals((list.columns ?? null) as JsonValue, columns as unknown as JsonValue))
        list.columns = columns
      setText(add, t.startVariableAdd)
      list.toggleAttribute('read-only', next.readonly)
      variables = Array.isArray(next.value) ? [...next.value] : []
      if (!jsonEquals((list.value ?? null) as JsonValue, variables))
        list.value = variables
      renderRows(t)
    }
    update(initial)
    return { element: list, update }
  }
}
