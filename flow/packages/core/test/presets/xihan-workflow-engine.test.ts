/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

/// <reference types="node" />

// 预设与 XiHan.Framework.Workflow 引擎逐项核对：读同级 XiHan.Framework 检出的源码（XIHAN_FRAMEWORK_DIR 可另指），
// 找不到时整组跳过。

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatJsonPath } from '@xihan-ui/core/json'
import { describe, expect, it } from 'vitest'
import { createFlowModel } from '../../src'
import { XIHAN_WORKFLOW_ACTIVITY_TYPES, xihanWorkflow, xihanWorkflowPropertyKeys } from '../../src/presets/xihan-workflow'

const FRAMEWORK = process.env.XIHAN_FRAMEWORK_DIR ?? fileURLToPath(new URL('../../../../../../XiHan.Framework', import.meta.url))
const WORKFLOW = join(FRAMEWORK, 'framework/src/XiHan.Framework.Workflow')
const ABSTRACTIONS = join(FRAMEWORK, 'framework/src/XiHan.Framework.Workflow.Abstractions')

function read(...parts: string[]): string {
  return readFileSync(join(...parts), 'utf8')
}

/** C# 类里 { get; set; } 属性的名字，按 JSON 的 camelCase 写。 */
function jsonFields(source: string): string[] {
  return [...source.matchAll(/public [\w<>?,\s]+? (\w+) \{ get; set; \}/g)].map(match => match[1]!.charAt(0).toLowerCase() + match[1]!.slice(1))
}

function enumMembers(source: string): string[] {
  return [...source.matchAll(/^\s*(\w+) = \d+,?$/gm)].map(match => match[1]!)
}

describe.skipIf(!existsSync(WORKFLOW))('与 XiHan.Framework.Workflow 引擎一致', () => {
  const activities = existsSync(WORKFLOW)
    ? readdirSync(join(WORKFLOW, 'Activities/BuiltIn')).filter(file => file.endsWith('.cs')).map((file) => {
        const source = read(WORKFLOW, 'Activities/BuiltIn', file)
        return {
          type: /\[WorkflowActivity\(WorkflowActivityTypes\.(\w+)/.exec(source)?.[1],
          behavior: /OutgoingBehavior = ActivityOutgoingBehavior\.(\w+)/.exec(source)?.[1] ?? 'AllMatched',
          keys: new Set([...source.matchAll(/\(context, "(\w+)"/g), ...source.matchAll(/Properties\.TryGetValue\("(\w+)"/g)].map(match => match[1]!)),
        }
      })
    : []
  const model = createFlowModel([xihanWorkflow])

  it('活动类型与 WorkflowActivityTypes 逐个对上，每种都有内置活动', () => {
    const constants = [...read(ABSTRACTIONS, 'WorkflowActivityTypes.cs').matchAll(/public const string (\w+) = "(\w+)";/g)].map(match => match[2]!)
    expect(constants.sort()).toEqual([...XIHAN_WORKFLOW_ACTIVITY_TYPES].sort())
    expect(activities.map(activity => activity.type).sort()).toEqual([...XIHAN_WORKFLOW_ACTIVITY_TYPES].sort())
  })

  it('每种活动读的属性键与预设的属性一一对上（汇聚的 Mode 由引擎读）', () => {
    expect(read(WORKFLOW, 'Engine/WorkflowEngine.cs')).toContain('node.Properties.TryGetValue("Mode"')
    const preset = xihanWorkflowPropertyKeys()
    for (const activity of activities) {
      const engine = activity.type === 'Join' ? new Set([...activity.keys, 'Mode']) : activity.keys
      expect([activity.type, [...preset[activity.type as keyof typeof preset]].sort()]).toEqual([activity.type, [...engine].sort()])
      const paths = (model.nodeTypes.get(activity.type!)!.properties ?? []).map(descriptor => formatJsonPath(descriptor.path))
      expect(paths.filter(path => path.startsWith('data.properties.')).map(path => path.slice('data.properties.'.length)).sort()).toEqual([...engine].sort())
    }
  })

  it('出线流转方式与出线属性对上', () => {
    const transition = jsonFields(read(ABSTRACTIONS, 'Definitions/WorkflowTransition.cs')).filter(field => !['id', 'name', 'sourceNodeId', 'targetNodeId'].includes(field))
    expect(transition.sort()).toEqual(['condition', 'isDefault', 'priority'])
    for (const activity of activities) {
      const nodeType = model.nodeTypes.get(activity.type!)!
      const outgoing = (nodeType.outgoingEdges ?? []).map(descriptor => formatJsonPath(descriptor.path))
      const expected = {
        None: [],
        All: [],
        Exclusive: ['data.condition', 'data.priority', 'data.isDefault'],
        AllMatched: ['data.condition'],
      }[activity.behavior]
      expect([activity.type, outgoing]).toEqual([activity.type, expected])
      expect([activity.type, nodeType.terminal === true]).toEqual([activity.type, activity.behavior === 'None'])
    }
  })

  it('下拉选项与引擎的枚举对上', () => {
    const options = (type: string, key: string): string[] => {
      const control = model.nodeTypes.get(type)!.properties!.find(item => item.path.at(-1) === key)!.control
      return 'options' in control ? control.options.map(option => String(option.value)) : []
    }
    expect(options('UserTask', 'CompletionPolicy')).toEqual(enumMembers(read(ABSTRACTIONS, 'UserTasks/UserTaskCompletionPolicy.cs')))
    expect(options('UserTask', 'EmptyAssigneeStrategy')).toEqual(enumMembers(read(ABSTRACTIONS, 'UserTasks/UserTaskEmptyAssigneeStrategy.cs')))
    const engine = read(WORKFLOW, 'Engine/WorkflowEngine.cs')
    for (const mode of options('Join', 'Mode'))
      expect(engine).toContain(`"${mode}"`)
  })

  it('节点级字段、重试策略与流程定义级属性的字段名对上', () => {
    const node = jsonFields(read(ABSTRACTIONS, 'Definitions/WorkflowNode.cs'))
    const retry = jsonFields(read(ABSTRACTIONS, 'Definitions/WorkflowRetryPolicy.cs'))
    const definition = jsonFields(read(ABSTRACTIONS, 'Definitions/WorkflowDefinition.cs'))
    const paths = model.nodeTypes.types.flatMap(type => (type.properties ?? []).map(descriptor => descriptor.path))
    const nodeLevel = new Set(paths.filter(path => path[0] === 'data' && path[1] !== 'properties').map(path => String(path[1])))
    expect([...nodeLevel].sort()).toEqual(node.filter(field => !['id', 'name', 'activityType', 'properties'].includes(field)).sort())
    const retryFields = new Set(paths.filter(path => path[1] === 'retryPolicy').map(path => String(path[2])))
    expect([...retryFields].sort()).toEqual(retry.sort())
    for (const descriptor of model.documentProperties)
      expect(definition).toContain(String(descriptor.path[1]))
  })
})
