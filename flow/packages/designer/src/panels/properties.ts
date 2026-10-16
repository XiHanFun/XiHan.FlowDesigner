/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的属性面板：按属性描述把选中的节点或连线渲染成一组字段，分组、显示条件与缺省值都取自 designer-kit/properties。
// 内建七种编辑方式用 UI 的字段元素，宿主可以按编辑方式、属性路径或节点类型换成自己的编辑器。
// 连续输入并成一步撤销，失焦或一次选择结束时封口。

import type { FlowEdge, FlowIssue, FlowNode, FlowNodeType, FlowPropertyDescriptor } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { PropertyEditorTable, PropertyGroup } from '@xihan-ui/designer-kit/properties'
import type { FlowEditor } from '../editor'
import type { FieldContext, FlowPropertyEditor, FlowPropertyEditorContext, FlowPropertyEditorInstance, FlowPropertyTarget } from './property-editors'
import { formatJsonPath, getJsonAt } from '@xihan-ui/core/json'
import { groupProperties, resolvePropertyEditor } from '@xihan-ui/designer-kit/properties'
import { createAuthoredElement, createGeneratedElement, setText } from '@xihan-ui/web-components/authoring'
import { builtinEditor } from './property-editors'

/** 连线缺省可编辑的属性：标签与虚线。 */
export const DEFAULT_EDGE_PROPERTIES: readonly FlowPropertyDescriptor[] = [
  { path: ['label'], control: { kind: 'text' } },
  { path: ['style', 'dashed'], control: { kind: 'boolean' } },
]

/** 节点类型没有声明属性时只编辑标签。 */
const DEFAULT_NODE_PROPERTIES: readonly FlowPropertyDescriptor[] = [
  { path: ['label'], control: { kind: 'text' } },
]

/** 属性面板需要设计器提供的能力与配置。 */
export interface PropertiesHost {
  readonly ownerDocument: Document
  readonly editor: FlowEditor
  readonly nextId: () => string
  readonly isReadonly: () => boolean
  readonly issues: () => readonly FlowIssue[]
  readonly editors: () => PropertyEditorTable<FlowPropertyEditor> | undefined
  readonly groupOrder: () => readonly string[] | undefined
  readonly groupLabels: () => Readonly<Record<string, string>> | undefined
  readonly edgeProperties: () => readonly FlowPropertyDescriptor[] | undefined
}

type Selected
  = | { readonly kind: 'node', readonly target: FlowNode, readonly nodeType: FlowNodeType | undefined }
    | { readonly kind: 'edge', readonly target: FlowEdge }

interface Row {
  readonly descriptor: FlowPropertyDescriptor
  readonly element: HTMLElement
  readonly error: HTMLElement
  instance: { readonly update?: (context: FieldContext) => void, readonly destroy?: () => void }
  localError: string | undefined
}

/** 属性面板：选中对象或显示中的属性变化时重建字段，其余时候只把新值交给各编辑器。 */
export class PropertiesPanel {
  readonly element: HTMLElement
  readonly #host: PropertiesHost
  readonly #title: HTMLElement
  readonly #subject: HTMLElement
  readonly #body: HTMLElement
  #structure = ''
  #rows: Row[] = []
  #selected: Selected | undefined
  #t: FlowDesignerTranslations | undefined
  #editorsSeen: PropertyEditorTable<FlowPropertyEditor> | undefined

  constructor(host: PropertiesHost) {
    this.#host = host
    const doc = host.ownerDocument
    this.element = createGeneratedElement(doc, 'div')
    this.element.dataset.part = 'properties'
    this.element.setAttribute('role', 'region')
    this.#title = createAuthoredElement(doc, 'div', { 'data-part': 'properties-title', 'id': host.nextId() })
    this.#subject = createAuthoredElement(doc, 'div', { 'data-part': 'properties-subject' })
    this.#body = createAuthoredElement(doc, 'div', { 'data-part': 'properties-body' })
    this.element.setAttribute('aria-labelledby', this.#title.id)
    this.element.append(createAuthoredElement(doc, 'div', { 'data-part': 'properties-header' }, [this.#title, this.#subject]), this.#body)
  }

  update(t: FlowDesignerTranslations): void {
    this.#t = t
    setText(this.#title, t.properties)
    const editor = this.#host.editor
    const { nodes, edges } = editor.selection
    const count = nodes.length + edges.length
    this.#selected = count !== 1 ? undefined : this.#find(nodes[0], edges[0])
    const selected = this.#selected
    if (!selected) {
      this.#subject.hidden = true
      this.#showMessage(count === 0 ? t.propertiesEmpty : t.propertiesMultiple(count), `message:${count}`)
      return
    }
    const name = selected.kind === 'node' ? selected.nodeType?.label ?? selected.target.type : t.edge
    setText(this.#subject, `${name} · ${selected.target.id}`)
    this.#subject.hidden = false

    const descriptors = this.#descriptors(selected)
    const groups = groupProperties(descriptors, selected.target as unknown as JsonValue, this.#host.groupOrder())
    const labels = groups.flatMap(group => group.properties.map(descriptor => this.#label(descriptor, t)))
    const structure = JSON.stringify([
      selected.kind,
      selected.target.id,
      selected.kind === 'node' ? selected.target.type : '',
      groups.map(group => [group.group ?? '', group.properties.map(descriptor => formatJsonPath(descriptor.path))]),
      labels,
      this.#host.isReadonly(),
    ])
    if (structure !== this.#structure || this.#editorsChanged()) {
      this.#structure = structure
      this.#build(selected, groups, t)
      return
    }
    for (const row of this.#rows)
      this.#refresh(row)
  }

  #editorsChanged(): boolean {
    const editors = this.#host.editors()
    if (editors === this.#editorsSeen)
      return false
    this.#editorsSeen = editors
    return true
  }

  #find(nodeId: string | undefined, edgeId: string | undefined): Selected | undefined {
    const editor = this.#host.editor
    if (nodeId !== undefined) {
      const node = editor.document.nodes.find(item => item.id === nodeId)
      return node && { kind: 'node', target: node, nodeType: editor.registry.get(node.type) }
    }
    const edge = editor.document.edges.find(item => item.id === edgeId)
    return edge && { kind: 'edge', target: edge }
  }

  #descriptors(selected: Selected): readonly FlowPropertyDescriptor[] {
    if (selected.kind === 'edge')
      return this.#host.edgeProperties() ?? DEFAULT_EDGE_PROPERTIES
    return selected.nodeType?.properties ?? DEFAULT_NODE_PROPERTIES
  }

  #label(descriptor: FlowPropertyDescriptor, t: FlowDesignerTranslations): string {
    return descriptor.label ?? t.propertyLabel(formatJsonPath(descriptor.path))
  }

  #showMessage(text: string, structure: string): void {
    if (this.#structure === structure)
      return
    this.#structure = structure
    this.#clear()
    this.#body.append(createAuthoredElement(this.#host.ownerDocument, 'p', { 'data-part': 'properties-empty' }, [text]))
  }

  #clear(): void {
    for (const row of this.#rows)
      row.instance.destroy?.()
    this.#rows = []
    this.#editorsSeen = this.#host.editors()
    this.#body.replaceChildren()
  }

  #build(selected: Selected, groups: readonly PropertyGroup<FlowPropertyDescriptor>[], t: FlowDesignerTranslations): void {
    this.#clear()
    const doc = this.#host.ownerDocument
    const labels = this.#host.groupLabels() ?? {}
    for (const group of groups) {
      const rows = group.properties.map(descriptor => this.#createRow(selected, descriptor, t))
      if (group.group === undefined) {
        this.#body.append(createAuthoredElement(doc, 'div', { 'data-part': 'property-group' }, rows.map(row => row.element)))
        continue
      }
      const title = Object.hasOwn(labels, group.group) ? labels[group.group]! : group.group
      const label = createAuthoredElement(doc, 'div', { 'data-part': 'property-group-label', 'id': this.#host.nextId() }, [title])
      this.#body.append(createAuthoredElement(doc, 'div', {
        'data-part': 'property-group',
        'role': 'group',
        'aria-labelledby': label.id,
      }, [label, ...rows.map(row => row.element)]))
    }
  }

  #createRow(selected: Selected, descriptor: FlowPropertyDescriptor, t: FlowDesignerTranslations): Row {
    const doc = this.#host.ownerDocument
    const kindOfTarget = selected.kind === 'node' ? selected.target.type : 'edge'
    const custom = resolvePropertyEditor(this.#host.editors() ?? { byControl: {} }, kindOfTarget, descriptor)
    const builtin = custom === undefined ? builtinEditor(descriptor.control.kind) : undefined
    const error = createAuthoredElement(doc, 'p', { 'data-part': 'property-error', 'hidden': true })
    const hintText = descriptor.meta !== undefined && typeof descriptor.meta.description === 'string' ? descriptor.meta.description : undefined
    const children: HTMLElement[] = []
    const row: Row = {
      descriptor,
      element: createAuthoredElement(doc, 'div', { 'data-part': 'property', 'data-path': formatJsonPath(descriptor.path) }),
      error,
      instance: {},
      localError: undefined,
    }
    const context = this.#context(row)
    if (builtin) {
      const created = builtin(context)
      row.instance = created
      children.push(created.element)
    }
    else if (custom) {
      const created: FlowPropertyEditorInstance = custom(plainContext(context))
      row.instance = { update: next => created.update?.(plainContext(next)), destroy: created.destroy }
      children.push(createAuthoredElement(doc, 'div', { 'data-part': 'property-label' }, [this.#label(descriptor, t)]), created.element)
    }
    else {
      children.push(
        createAuthoredElement(doc, 'div', { 'data-part': 'property-label' }, [this.#label(descriptor, t)]),
        createAuthoredElement(doc, 'p', { 'data-part': 'property-unsupported' }, [descriptor.control.kind]),
      )
    }
    if (hintText !== undefined)
      children.push(createAuthoredElement(doc, 'p', { 'data-part': 'property-hint' }, [hintText]))
    children.push(error)
    row.element.append(...children)
    this.#rows.push(row)
    this.#paintError(row, context)
    return row
  }

  /** 当前对象上这一行的上下文。 */
  #context(row: Row): FieldContext {
    const selected = this.#selected!
    const t = this.#t!
    const editor = this.#host.editor
    const message = row.localError ?? this.#issueMessage(selected, row.descriptor.path)
    const readonly = this.#host.isReadonly()
    const id = selected.target.id
    const kind = selected.kind
    return {
      ownerDocument: this.#host.ownerDocument,
      value: getJsonAt(selected.target as unknown as JsonValue, row.descriptor.path),
      descriptor: row.descriptor,
      target: selected.target,
      readonly,
      label: this.#label(row.descriptor, t),
      required: row.descriptor.required === true,
      invalid: message !== undefined,
      invalidJson: t.invalidJson,
      setValue: (value) => {
        if (this.#host.isReadonly())
          return
        if (kind === 'node')
          editor.setNodeProperty(id, row.descriptor.path, value)
        else
          editor.setEdgeProperty(id, row.descriptor.path, value)
      },
      commit: () => editor.seal(),
      setLocalError: (next) => {
        if (row.localError === next)
          return
        row.localError = next
        this.#refresh(row)
      },
    }
  }

  #issueMessage(selected: Selected, path: JsonPath): string | undefined {
    const key = formatJsonPath(path)
    const issue = this.#host.issues().find(item =>
      item.target?.kind === selected.kind
      && item.target.id === selected.target.id
      && formatJsonPath(item.path.slice(2)) === key)
    if (!issue)
      return undefined
    const registry = this.#host.editor.registry
    return this.#t!.issue(issue, { nodeType: type => registry.get(type)?.label ?? type })
  }

  #refresh(row: Row): void {
    const context = this.#context(row)
    row.instance.update?.(context)
    this.#paintError(row, context)
  }

  #paintError(row: Row, context: FieldContext): void {
    const message = row.localError ?? this.#issueMessage(this.#selected!, row.descriptor.path)
    setText(row.error, message ?? '')
    row.error.hidden = message === undefined
    row.element.toggleAttribute('data-invalid', context.invalid)
  }
}

function plainContext(context: FieldContext): FlowPropertyEditorContext {
  return {
    value: context.value,
    descriptor: context.descriptor,
    target: context.target as FlowPropertyTarget,
    readonly: context.readonly,
    setValue: context.setValue,
    commit: context.commit,
  }
}
