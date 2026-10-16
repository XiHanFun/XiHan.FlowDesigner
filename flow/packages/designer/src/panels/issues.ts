/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的问题列表：把最近一次校验的问题换好文字交给 <xh-designer-issues>，点一条落在节点或连线上的问题就选中并显露它。

import type { FlowDocument, FlowIssue, FlowNodeTypeRegistry, FlowPropertyDescriptor } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { DesignerIssueItem, DesignerIssuesEventMap, XhDesignerIssuesElement } from '@xihan-ui/designer-shell'
import { formatJsonPath } from '@xihan-ui/core/json'
import { createGeneratedElement } from '@xihan-ui/web-components/authoring'

/** 问题列表需要设计器提供的能力。 */
export interface IssuesHost {
  readonly ownerDocument: Document
  readonly document: () => FlowDocument
  readonly registry: () => FlowNodeTypeRegistry
  readonly issues: () => readonly FlowIssue[]
  readonly edgeProperties: () => readonly FlowPropertyDescriptor[]
  /** 选中问题所在的对象并显露它。 */
  readonly locate: (issue: FlowIssue) => void
}

/** 问题列表：问题、定义或文案变化时重新换文字。 */
export class IssuesPanel {
  readonly element: XhDesignerIssuesElement
  readonly #host: IssuesHost
  #rendered: readonly unknown[] = []

  constructor(host: IssuesHost) {
    this.#host = host
    this.element = createGeneratedElement(host.ownerDocument, 'xh-designer-issues', { 'data-part': 'issues' })
    this.element.addEventListener('issue-activate', (event) => {
      host.locate((event as DesignerIssuesEventMap['issue-activate']).detail.issue as FlowIssue)
    })
  }

  update(t: FlowDesignerTranslations): void {
    this.element.emptyText = t.issuesEmpty
    const issues = this.#host.issues()
    const inputs = [issues, this.#host.document(), this.#host.registry(), this.#host.edgeProperties(), t.issue, t.propertyIssue, t.propertyLabel, t.edge, t.flow]
    if (inputs.length === this.#rendered.length && inputs.every((input, index) => input === this.#rendered[index]))
      return
    this.#rendered = inputs
    this.element.items = issues.map((issue): DesignerIssueItem => ({ issue, message: this.#message(issue, t), subject: this.#subject(issue, t) }))
  }

  #subject(issue: FlowIssue, t: FlowDesignerTranslations): string {
    const target = issue.target
    if (target?.kind === 'node') {
      const node = this.#host.document().nodes.find(item => item.id === target.id)
      return node?.label ?? (node && this.#host.registry().get(node.type)?.label) ?? target.id
    }
    if (target?.kind === 'edge') {
      const edge = this.#host.document().edges.find(item => item.id === target.id)
      return `${t.edge} ${edge?.label ?? target.id}`
    }
    return t.flow
  }

  /** 问题说明；落在属性上的问题带上属性名。 */
  #message(issue: FlowIssue, t: FlowDesignerTranslations): string {
    const registry = this.#host.registry()
    const text = t.issue(issue, { nodeType: type => registry.get(type)?.label ?? type })
    const property = this.#property(issue)
    return property === undefined ? text : t.propertyIssue(property.label ?? t.propertyLabel(formatJsonPath(property.path)), text)
  }

  #property(issue: FlowIssue): FlowPropertyDescriptor | undefined {
    const target = issue.target
    if (!target || issue.path.length <= 2)
      return undefined
    const key = formatJsonPath(issue.path.slice(2))
    let descriptors: readonly FlowPropertyDescriptor[] = []
    if (target.kind === 'node') {
      const node = this.#host.document().nodes.find(item => item.id === target.id)
      descriptors = (node && this.#host.registry().get(node.type)?.properties) ?? []
    }
    else if (target.kind === 'edge') {
      descriptors = this.#host.edgeProperties()
    }
    return descriptors.find(descriptor => formatJsonPath(descriptor.path) === key)
  }
}
