/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的属性面板：把选中的节点与连线交给 <xh-designer-properties>，选中多个时只编辑共同属性；
// 什么都没选中时编辑流程定义级属性。节点按类型取属性描述，连线取不随源节点类型的连线属性加上源节点类型的出线属性；
// 面板派发的写入换成编辑器的 setProperty，一次编辑结束时封口。

import type { FlowIssue, FlowPropertyDescriptor } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { PropertyEditorContext, PropertyEditorInstance, PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type {
  DesignerPropertiesEventMap,
  DesignerPropertyDescriptor,
  DesignerPropertyEditor,
  DesignerPropertyError,
  DesignerPropertyTarget,
  XhDesignerPropertiesElement,
} from '@xihan-ui/designer-shell'
import type { FlowEditor, FlowPropertyRef } from '../editor'
import { formatJsonPath } from '@xihan-ui/core/json'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'

/** 节点类型没有声明属性时只编辑标签。 */
const DEFAULT_NODE_PROPERTIES: readonly FlowPropertyDescriptor[] = [
  { path: ['label'], control: { kind: 'text' } },
]

/** 交给属性编辑器的对象：kind 是节点类型（连线为 edge，流程定义为 document），value 是节点、连线或流程定义本身。 */
export type FlowPropertyTarget = DesignerPropertyTarget

/** 宿主提供的属性编辑器。 */
export type FlowPropertyEditor = DesignerPropertyEditor

/** 交给属性编辑器的上下文：target 是当前全部被编辑的对象。 */
export type FlowPropertyEditorContext = PropertyEditorContext<DesignerPropertyDescriptor, readonly DesignerPropertyTarget[]>

/** 属性编辑器实例。 */
export type FlowPropertyEditorInstance = PropertyEditorInstance<DesignerPropertyDescriptor, readonly DesignerPropertyTarget[]>

/** 属性面板需要设计器提供的能力与配置。 */
export interface PropertiesHost {
  readonly ownerDocument: Document
  readonly editor: FlowEditor
  readonly isReadonly: () => boolean
  readonly issues: () => readonly FlowIssue[]
  readonly editors: () => PropertyEditorTable<FlowPropertyEditor>
  readonly groupOrder: () => readonly string[] | undefined
  readonly groupLabels: () => Readonly<Record<string, string>> | undefined
}

/** 流程定义在属性面板里的对象种类。 */
export const DOCUMENT_TARGET_KIND = 'document'

function refKey(kind: string, id: string): string {
  return `${kind}\u0000${id}`
}

function hintOf(descriptor: DesignerPropertyDescriptor): string | undefined {
  const description = descriptor.meta?.description
  return typeof description === 'string' ? description : undefined
}

/** 属性面板：每次设计器更新时把选择与问题换成面板的输入，只在真的变了时才赋值。 */
export class PropertiesPanel {
  readonly element: XhDesignerPropertiesElement
  readonly #host: PropertiesHost
  #refs = new Map<string, FlowPropertyRef>()
  #labels: Readonly<Record<string, string>> | undefined
  #groupLabel: ((group: string) => string) | undefined
  #propertyLabel: FlowDesignerTranslations['propertyLabel'] | undefined
  #labelOf: ((descriptor: DesignerPropertyDescriptor) => string) | undefined
  #errorsKey = ''

  constructor(host: PropertiesHost) {
    this.#host = host
    this.element = createGeneratedElement(host.ownerDocument, 'xh-designer-properties', { 'data-part': 'properties' })
    this.element.hintOf = hintOf
    this.element.addEventListener('property-change', (event) => {
      const { path, value, targets, merge } = (event as DesignerPropertiesEventMap['property-change']).detail
      if (host.isReadonly())
        return
      const refs = targets.flatMap(target => this.#refs.get(refKey(target.kind, target.id)) ?? [])
      host.editor.setProperty(refs, path, value, { merge })
    })
    this.element.addEventListener('property-commit', () => host.editor.seal())
  }

  update(t: FlowDesignerTranslations): void {
    const panel = this.element
    const editor = this.#host.editor
    const document = editor.document
    const { nodes, edges } = editor.selection
    const refs = new Map<string, FlowPropertyRef>()
    const targets: DesignerPropertyTarget[] = []
    let heading: string | undefined
    const model = editor.model
    for (const id of nodes) {
      const node = document.nodes.find(item => item.id === id)
      if (!node)
        continue
      const nodeType = model.nodeTypes.get(node.type)
      targets.push({ kind: node.type, id, value: node as unknown as JsonValue, descriptors: nodeType?.properties ?? DEFAULT_NODE_PROPERTIES })
      refs.set(refKey(node.type, id), { kind: 'node', id })
      heading = `${nodeType?.label ?? node.type} · ${id}`
    }
    for (const id of edges) {
      const edge = document.edges.find(item => item.id === id)
      if (!edge)
        continue
      const source = document.nodes.find(item => item.id === edge.source.node)
      targets.push({ kind: 'edge', id, value: edge as unknown as JsonValue, descriptors: model.edgePropertiesOf(source?.type) })
      refs.set(refKey('edge', id), { kind: 'edge', id })
      heading = `${t.edge} · ${id}`
    }
    if (nodes.length === 0 && edges.length === 0 && model.documentProperties.length > 0) {
      targets.push({ kind: DOCUMENT_TARGET_KIND, id: '', value: document as unknown as JsonValue, descriptors: model.documentProperties })
      refs.set(refKey(DOCUMENT_TARGET_KIND, ''), { kind: 'document', id: '' })
      heading = t.flow
    }
    this.#refs = refs
    if (!sameTargets(panel.targets, targets))
      panel.targets = targets
    panel.heading = targets.length > 1 ? t.propertiesMultiple(targets.length) : heading
    panel.emptyText = t.propertiesEmpty
    panel.readonly = this.#host.isReadonly()
    panel.editors = this.#host.editors()
    panel.groupOrder = this.#host.groupOrder()
    const labels = this.#host.groupLabels()
    if (labels !== this.#labels || !this.#groupLabel) {
      this.#labels = labels
      this.#groupLabel = group => (labels && Object.hasOwn(labels, group) ? labels[group]! : group)
    }
    panel.groupLabel = this.#groupLabel
    if (t.propertyLabel !== this.#propertyLabel || !this.#labelOf) {
      const propertyLabel = t.propertyLabel
      this.#propertyLabel = propertyLabel
      this.#labelOf = descriptor => descriptor.label ?? propertyLabel(formatJsonPath(descriptor.path))
    }
    panel.labelOf = this.#labelOf
    const errors = this.#errors(targets, t)
    const errorsKey = JSON.stringify(errors)
    if (errorsKey !== this.#errorsKey) {
      this.#errorsKey = errorsKey
      panel.errors = errors
    }
  }

  /** 把焦点交给该属性的字段（path 相对对象）；找不到时返回 false。 */
  focusField(path: JsonPath): boolean {
    return this.element.focusField(path)
  }

  /** 落在选中对象属性上的问题，path 换成相对对象；流程定义级属性的问题不带 target，path 就是属性路径。 */
  #errors(targets: readonly DesignerPropertyTarget[], t: FlowDesignerTranslations): DesignerPropertyError[] {
    const registry = this.#host.editor.model.nodeTypes
    const names = { nodeType: (type: string) => registry.get(type)?.label ?? type }
    const errors: DesignerPropertyError[] = []
    const documentTarget = targets.find(entry => entry.kind === DOCUMENT_TARGET_KIND && entry.id === '')
    for (const issue of this.#host.issues()) {
      if (!issue.target) {
        if (documentTarget && issue.path.length > 0)
          errors.push({ target: { kind: documentTarget.kind, id: '' }, path: issue.path, message: t.issue(issue, names) })
        continue
      }
      if (issue.path.length <= 2)
        continue
      const target = targets.find(entry => entry.id === issue.target!.id && (entry.kind === 'edge') === (issue.target!.kind === 'edge'))
      if (target)
        errors.push({ target: { kind: target.kind, id: target.id }, path: issue.path.slice(2), message: t.issue(issue, names) })
    }
    return errors
  }
}

function sameTargets(current: readonly DesignerPropertyTarget[] | undefined, next: readonly DesignerPropertyTarget[]): boolean {
  return current !== undefined && current.length === next.length && current.every((target, index) => {
    const other = next[index]!
    return target.kind === other.kind && target.id === other.id && target.value === other.value && target.descriptors === other.descriptors
  })
}
