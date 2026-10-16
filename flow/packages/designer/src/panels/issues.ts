/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的问题列表：列出最近一次校验的问题与错误、警告数，点一条落在节点或连线上的问题就选中并显露它。

import type { FlowDocument, FlowIssue, FlowNodeTypeRegistry, FlowPropertyDescriptor } from '@xihan-flow/core'
import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import { formatJsonPath } from '@xihan-ui/core/json'
import { createAuthoredElement, createGeneratedElement, setText } from '@xihan-ui/web-components/authoring'

/** 问题列表需要设计器提供的能力。 */
export interface IssuesHost {
  readonly ownerDocument: Document
  readonly nextId: () => string
  readonly document: () => FlowDocument
  readonly registry: () => FlowNodeTypeRegistry
  readonly issues: () => readonly FlowIssue[]
  readonly edgeProperties: () => readonly FlowPropertyDescriptor[]
  /** 选中问题所在的对象并显露它。 */
  readonly locate: (issue: FlowIssue) => void
}

/** 问题列表：问题、定义或文案变化时重建列表。 */
export class IssuesPanel {
  readonly element: HTMLElement
  readonly #host: IssuesHost
  readonly #title: HTMLElement
  readonly #errors: HTMLElement
  readonly #warnings: HTMLElement
  readonly #list: HTMLElement
  readonly #empty: HTMLElement
  #rendered: readonly unknown[] = []
  #shown: readonly FlowIssue[] = []

  constructor(host: IssuesHost) {
    this.#host = host
    const doc = host.ownerDocument
    this.element = createGeneratedElement(doc, 'div')
    this.element.dataset.part = 'issues'
    this.element.setAttribute('role', 'region')
    this.#title = createAuthoredElement(doc, 'span', { 'data-part': 'issues-title', 'id': host.nextId() })
    this.#errors = tag(doc, 'danger')
    this.#warnings = tag(doc, 'warning')
    this.#list = createAuthoredElement(doc, 'ul', { 'data-part': 'issues-list', 'role': 'list' })
    this.#empty = createAuthoredElement(doc, 'p', { 'data-part': 'issues-empty' })
    this.element.setAttribute('aria-labelledby', this.#title.id)
    this.element.append(createAuthoredElement(doc, 'div', { 'data-part': 'issues-header' }, [this.#title, this.#errors, this.#warnings]), this.#list, this.#empty)
    this.#list.addEventListener('click', this.#onClick)
  }

  update(t: FlowDesignerTranslations): void {
    const issues = this.#host.issues()
    const document = this.#host.document()
    setText(this.#title, t.issues)
    const errors = issues.filter(issue => issue.severity === 'error').length
    const warnings = issues.length - errors
    paintTag(this.#errors, errors === 0 ? undefined : t.errorCount(errors))
    paintTag(this.#warnings, warnings === 0 ? undefined : t.warningCount(warnings))
    setText(this.#empty, t.issuesEmpty)
    this.#empty.hidden = issues.length > 0
    const inputs = [issues, document, this.#host.registry(), this.#host.edgeProperties(), t.issue, t.propertyIssue, t.propertyLabel, t.severityError, t.severityWarning, t.edge, t.flow]
    if (inputs.length === this.#rendered.length && inputs.every((input, index) => input === this.#rendered[index]))
      return
    this.#rendered = inputs
    this.#shown = issues
    this.#list.replaceChildren(...issues.map((issue, index) => this.#item(issue, index, t)))
  }

  #item(issue: FlowIssue, index: number, t: FlowDesignerTranslations): HTMLElement {
    const doc = this.#host.ownerDocument
    const severity = issue.severity ?? 'error'
    const children = [
      createAuthoredElement(doc, 'span', { 'data-part': 'issue-severity' }, [severity === 'error' ? t.severityError : t.severityWarning]),
      createAuthoredElement(doc, 'span', { 'data-part': 'issue-subject' }, [this.#subject(issue, t)]),
      createAuthoredElement(doc, 'span', { 'data-part': 'issue-message' }, [this.#message(issue, t)]),
    ]
    const body = issue.target === undefined
      ? createAuthoredElement(doc, 'div', { 'data-part': 'issue', 'data-severity': severity }, children)
      : createAuthoredElement(doc, 'button', { 'data-part': 'issue', 'data-severity': severity, 'type': 'button', 'data-index': index }, children)
    return createAuthoredElement(doc, 'li', {}, [body])
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

  readonly #onClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-part="issue"]')
    const issue = button && this.#shown[Number(button.dataset.index)]
    if (issue)
      this.#host.locate(issue)
  }
}

function tag(doc: Document, tone: string): HTMLElement {
  return createAuthoredElement(doc, 'xh-tag', { 'tone': tone, 'variant': 'subtle', 'size': 'sm', 'data-part': `issues-${tone}` }, [
    createAuthoredElement(doc, 'span', { 'data-xh-part': 'root' }, [createAuthoredElement(doc, 'span', { 'data-xh-part': 'label' })]),
  ])
}

function paintTag(element: HTMLElement, text: string | undefined): void {
  element.hidden = text === undefined
  setText(element.querySelector('[data-xh-part="label"]')!, text ?? '')
}
