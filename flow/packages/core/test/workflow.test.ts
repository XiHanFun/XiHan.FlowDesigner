/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '@xihan-ui/core/json'
import type { FlowDocument } from '../src'
import type { WorkflowDefinitionJson } from './fixtures/workflow'
import { setJsonAt } from '@xihan-ui/core/json'
import { groupProperties } from '@xihan-ui/designer-kit/properties'
import { describe, expect, it } from 'vitest'
import { readDocument, validateDocument } from '../src'
import { approvalDefinition, fromDefinition, toDefinition, workflowRegistry } from './fixtures/workflow'

function normalize(definition: WorkflowDefinitionJson): unknown {
  return { ...definition, extraProperties: { ...definition.extraProperties, designerLayout: JSON.parse(definition.extraProperties.designerLayout!) } }
}

describe('工作流定义的表达', () => {
  it('定义 → 文档 → 定义往返不丢字段', () => {
    const definition = approvalDefinition()
    const document = fromDefinition(definition)
    expect(normalize(toDefinition(document))).toEqual(normalize(definition))
  })

  it('文档是纯 JSON，经序列化往返后可原样读回', () => {
    const document = fromDefinition(approvalDefinition())
    const read = readDocument(JSON.parse(JSON.stringify(document)))
    expect(read).toEqual({ ok: true, document })
  })

  it('活动类型决定端口，默认分支用虚线与标签表示', () => {
    const document = fromDefinition(approvalDefinition())
    expect(workflowRegistry.get('Start')!.ports.map(port => port.direction)).toEqual(['out'])
    expect(workflowRegistry.get('End')!.ports.map(port => port.direction)).toEqual(['in'])
    const fallback = document.edges.find(edge => edge.id === 't4')!
    expect(fallback.style).toEqual({ dashed: true })
    expect(fallback.label).toBe('default')
    expect(document.edges.find(edge => edge.id === 't3')!.label).toBe('同意')
  })

  it('合法的审批流程没有问题', () => {
    expect(validateDocument(fromDefinition(approvalDefinition()), workflowRegistry)).toEqual([])
  })

  it('受理人规则缺失、开始节点重复与死路都能报告', () => {
    const document = fromDefinition(approvalDefinition())
    const approve = document.nodes[1]!
    const broken: FlowDocument = {
      ...document,
      nodes: [
        ...document.nodes.slice(0, 1),
        { ...approve, data: setJsonAt(approve.data ?? {}, ['properties', 'AssigneeRules'], []).root },
        ...document.nodes.slice(2),
        { id: 'start2', type: 'Start', x: 0, y: 300, width: 160, height: 48 },
        { id: 'http', type: 'Http', x: 300, y: 300, width: 200, height: 64, data: { properties: { Url: 'https://x' } } },
      ],
      edges: [...document.edges, { id: 't5', source: { node: 'start2' }, target: { node: 'http' } }],
    }
    expect(validateDocument(broken, workflowRegistry).map(issue => `${issue.code}:${issue.target?.kind === 'node' ? issue.target.id : ''}`)).toEqual([
      'type.max-count:',
      'node.missing-outgoing:http',
      'required:approve',
    ])
  })

  it('兜底受理人只在选择兜底策略或已填写时显示并要求填写', () => {
    const userTask = workflowRegistry.get('UserTask')!
    const data = (strategy: string, fallback?: unknown[]): JsonObject => ({
      properties: { AssigneeRules: [{ kind: 'role' }], EmptyAssigneeStrategy: strategy, ...(fallback ? { FallbackAssigneeRules: fallback as JsonObject[] } : {}) },
    })
    const participants = (value: JsonObject): unknown[] => groupProperties(userTask.properties!, { data: value }, ['basic', 'participants'])
      .find(group => group.group === 'participants')!
      .properties
      .map(descriptor => descriptor.path.at(-1)!)
    expect(participants(data('Fault'))).not.toContain('FallbackAssigneeRules')
    expect(participants(data('Fallback'))).toContain('FallbackAssigneeRules')
    expect(participants(data('Fault', [{ kind: 'user' }]))).toContain('FallbackAssigneeRules')

    const withNode = (value: JsonObject): FlowDocument => {
      const document = fromDefinition(approvalDefinition())
      return { ...document, nodes: document.nodes.map(node => node.id === 'approve' ? { ...node, data: value } : node) }
    }
    expect(validateDocument(withNode(data('Fault')), workflowRegistry)).toEqual([])
    expect(validateDocument(withNode(data('Fallback')), workflowRegistry).map(issue => [issue.code, issue.target?.id, issue.path.slice(2)])).toEqual([
      ['required', 'approve', ['data', 'properties', 'FallbackAssigneeRules']],
    ])
  })
})
