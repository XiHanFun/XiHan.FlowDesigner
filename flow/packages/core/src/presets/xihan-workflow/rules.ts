/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// XiHan 工作流引擎发布定义时把关、而通用校验覆盖不到的规则，以及受理人规则这种编辑方式的取值检查。

import type { SchemaRule } from '@xihan-ui/designer-kit'
import type { ControlKind } from '@xihan-ui/designer-kit/properties'
import type { SchemaIssue } from '@xihan-ui/designer-kit/schema'
import type { FlowRuleContext } from '../../extensions'
import type { FlowDocument, FlowEdge } from '../../schema'
import type { XihanWorkflowIssueCode } from './texts'
import { isPlainObject } from '@xihan-ui/core/json'

type Rule = SchemaRule<FlowDocument, FlowRuleContext>

function issue(code: XihanWorkflowIssueCode, severity: 'error' | 'warning', document: FlowDocument, nodeIndex?: number): SchemaIssue {
  if (nodeIndex === undefined)
    return { code, path: [], severity }
  return { code, path: ['nodes', nodeIndex], target: { kind: 'node', id: document.nodes[nodeIndex]!.id }, severity }
}

/** 每个节点 id 首次出现的下标；重复 id 的节点由通用校验报，这里只看首次出现的那个。 */
function primaryNodes(document: FlowDocument): Map<string, number> {
  const indexes = new Map<string, number>()
  document.nodes.forEach((node, index) => {
    if (!indexes.has(node.id))
      indexes.set(node.id, index)
  })
  return indexes
}

function propertiesOf(document: FlowDocument, index: number): Readonly<Record<string, unknown>> {
  const properties = document.nodes[index]!.data?.properties
  return isPlainObject(properties) ? properties : {}
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0

/** 流程没有结束或终止节点。 */
const noEnd: Rule = document =>
  document.nodes.length > 0 && !document.nodes.some(node => node.type === 'End' || node.type === 'Terminate')
    ? [issue('xihan-workflow.no-end', 'warning', document)]
    : []

/** 条件分支：至多一条默认分支；有条件分支时要有默认分支或无条件分支兜底。 */
const decisionBranches: Rule = (document) => {
  const issues: SchemaIssue[] = []
  const outgoing = new Map<string, FlowEdge[]>()
  for (const edge of document.edges)
    outgoing.set(edge.source.node, [...(outgoing.get(edge.source.node) ?? []), edge])
  for (const [id, index] of primaryNodes(document)) {
    if (document.nodes[index]!.type !== 'Decision')
      continue
    const edges = outgoing.get(id) ?? []
    const isDefault = (edge: FlowEdge): boolean => edge.data?.isDefault === true
    const defaults = edges.filter(isDefault).length
    if (defaults > 1)
      issues.push(issue('xihan-workflow.decision-multiple-defaults', 'error', document, index))
    const conditional = edges.some(edge => !isDefault(edge) && hasText(edge.data?.condition))
    const fallback = edges.some(edge => isDefault(edge) || !hasText(edge.data?.condition))
    if (conditional && !fallback)
      issues.push(issue('xihan-workflow.decision-no-default', 'warning', document, index))
  }
  return issues
}

/** 人工任务要配置受理人规则、受理人或受理人表达式之一；与引擎一样，配了键（哪怕是空列表）就算配了。 */
const userTaskAssignees: Rule = (document) => {
  const issues: SchemaIssue[] = []
  for (const index of primaryNodes(document).values()) {
    if (document.nodes[index]!.type !== 'UserTask')
      continue
    const properties = propertiesOf(document, index)
    const present = (key: string): boolean => properties[key] !== undefined && properties[key] !== null
    const rules = properties.AssigneeRules
    if (!present('Assignees') && !present('AssigneesExpression') && !(Array.isArray(rules) && rules.length > 0))
      issues.push(issue('xihan-workflow.user-task-no-assignee', 'error', document, index))
  }
  return issues
}

/** 预设的规则。 */
export const XIHAN_WORKFLOW_RULES: readonly Rule[] = [noEnd, decisionBranches, userTaskAssignees]

/**
 * 受理人规则的取值：{ type, values } 的数组，type 不能为空，values 是字符串数组。
 * 引擎内置的两种还要看参数：User 至少一个用户，Expression 恰好一条非空表达式；应用登记的类型不看参数。
 */
export const ASSIGNEE_RULES_CONTROL: ControlKind = {
  check(value) {
    if (!Array.isArray(value))
      return 'invalid-type'
    for (const rule of value) {
      if (!isPlainObject(rule) || !hasText(rule.type))
        return 'invalid-value'
      const values = rule.values ?? []
      if (!Array.isArray(values) || values.some(item => typeof item !== 'string'))
        return 'invalid-value'
      if (rule.type === 'User' && !values.some(hasText))
        return 'invalid-value'
      if (rule.type === 'Expression' && (values.length !== 1 || !hasText(values[0])))
        return 'invalid-value'
    }
    return undefined
  },
}
