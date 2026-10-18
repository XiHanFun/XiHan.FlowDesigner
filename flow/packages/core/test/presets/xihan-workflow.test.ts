/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDocument, FlowIssue } from '../../src'
import type { XihanWorkflowDefinition, XihanWorkflowTexts } from '../../src/presets/xihan-workflow'
import { formatJsonPath } from '@xihan-ui/core/json'
import { describe, expect, it } from 'vitest'
import { createFlowModel, readDocument, resolveEdgeStyle, validateDocument } from '../../src'
import * as presets from '../../src/presets/xihan-workflow'
import {
  createXihanWorkflow,
  fromWorkflowDefinition,
  toWorkflowDefinition,
  XIHAN_WORKFLOW_ACTIVITY_TYPES,
  XIHAN_WORKFLOW_ASSIGNEE_RULES,
  XIHAN_WORKFLOW_START_VARIABLES,
  XIHAN_WORKFLOW_TEXTS,
  xihanWorkflow,
  xihanWorkflowEnUS,
  xihanWorkflowZhCN,
} from '../../src/presets/xihan-workflow'

const extensions = [xihanWorkflow]

function codes(document: FlowDocument): string[] {
  return validateDocument(document, { extensions }).map(issue => `${issue.code}@${issue.target?.id ?? formatJsonPath(issue.path)}`)
}

/** BasicApp 现存的定义 JSON 形状：坐标在 extraProperties.designerLayout，可空字段写 null。 */
function approval(): XihanWorkflowDefinition {
  return {
    id: '7300000000000000001',
    code: 'leave',
    name: '请假审批',
    version: 2,
    description: null,
    category: 'hr',
    status: 'published',
    enableCompensation: false,
    nodes: [
      { id: 'start', name: '提交', activityType: 'Start', properties: {}, retryPolicy: null, timeoutSeconds: null, continueOnError: false },
      {
        id: 'manager',
        name: '主管审批',
        activityType: 'UserTask',
        properties: { AssigneeRules: [{ type: 'Starter', values: [] }], CompletionPolicy: 'Any', Title: '{{billNo}} 请假' },
        retryPolicy: null,
        timeoutSeconds: 86400,
        continueOnError: false,
      },
      { id: 'days', name: '天数', activityType: 'Decision', properties: {} },
      { id: 'wait', name: '缓冲', activityType: 'Delay', properties: { DurationSeconds: 300 }, retryPolicy: { maxAttempts: 3, firstDelaySeconds: 10, backoffFactor: 2 } },
      { id: 'approved', name: '通过', activityType: 'End', properties: { Outcome: 'approved' } },
      { id: 'rejected', name: '驳回', activityType: 'End', properties: { Outcome: 'rejected' } },
    ],
    transitions: [
      { id: 't1', name: null, sourceNodeId: 'start', targetNodeId: 'manager', condition: null, priority: 0, isDefault: false },
      { id: 't2', sourceNodeId: 'manager', targetNodeId: 'days', condition: 'outcome == "approved"', priority: 0 },
      { id: 't3', sourceNodeId: 'manager', targetNodeId: 'rejected', condition: 'outcome == "rejected"', priority: 1 },
      { id: 't4', name: '超过三天', sourceNodeId: 'days', targetNodeId: 'wait', condition: 'days > 3', priority: 0 },
      { id: 't5', sourceNodeId: 'days', targetNodeId: 'approved', isDefault: true, priority: 1 },
      { id: 't6', sourceNodeId: 'wait', targetNodeId: 'approved', priority: 0 },
    ],
    variables: [{ name: 'days', type: 'number', required: true, defaultValue: null, description: null }],
    tenantId: null,
    creationTime: '2026-10-01T08:00:00Z',
    publishTime: null,
    extraProperties: {
      owner: 'hr',
      designerLayout: JSON.stringify({
        start: { x: 0, y: 100 },
        manager: { x: 200, y: 96 },
        days: { x: 420, y: 96 },
        wait: { x: 640, y: 20 },
        approved: { x: 860, y: 100 },
        rejected: { x: 420, y: 220 },
      }),
    },
  }
}

describe('xihanWorkflow 节点类型', () => {
  it('17 种活动一一对应，与其它扩展一起装上不冲突', () => {
    const model = createFlowModel(extensions)
    expect(model.nodeTypes.types.map(type => type.type).sort()).toEqual([...XIHAN_WORKFLOW_ACTIVITY_TYPES].sort())
    const start = model.nodeTypes.get('Start')!
    expect([start.entry, start.minCount, start.maxCount, start.ports.map(port => port.direction)]).toEqual([true, 1, 1, ['out']])
    for (const type of ['End', 'Terminate', 'Fault'])
      expect([model.nodeTypes.get(type)!.terminal, model.nodeTypes.get(type)!.ports.map(port => port.direction)]).toEqual([true, ['in']])
    expect(model.controls[XIHAN_WORKFLOW_ASSIGNEE_RULES]).toBeDefined()
  })

  it('人工任务、条件分支、并行分支、汇聚与结束标为常用，设计器顶栏给它们放插入钮', () => {
    const types = createFlowModel(extensions).nodeTypes.types
    const quick = types.filter(type => type.quickInsert !== undefined).sort((a, b) => a.quickInsert! - b.quickInsert!)
    expect(quick.map(type => type.type)).toEqual(['UserTask', 'Decision', 'Parallel', 'Join', 'End'])
  })

  it('每种活动都配了图标，图标各不相同，是能直接画的图标记录', () => {
    const types = createFlowModel(extensions).nodeTypes.types
    expect(types.filter(type => type.icon === undefined).map(type => type.type)).toEqual([])
    expect(new Set(types.map(type => type.icon!.name)).size).toBe(XIHAN_WORKFLOW_ACTIVITY_TYPES.length)
    for (const type of types)
      expect([type.icon!.viewBox, type.icon!.nodes.length > 0]).toEqual(['0 0 24 24', true])
  })

  it('出线属性随源节点类型：条件分支有条件、优先级与默认分支，并行分支忽略条件，结束类没有出线', () => {
    const model = createFlowModel(extensions)
    const paths = (type: string): string[] => model.edgePropertiesOf(type).map(descriptor => formatJsonPath(descriptor.path))
    expect(paths('Decision')).toEqual(['label', 'style.dashed', 'data.condition', 'data.priority', 'data.isDefault'])
    expect(paths('UserTask')).toEqual(['label', 'style.dashed', 'data.condition'])
    expect(paths('Parallel')).toEqual(['label', 'style.dashed'])
    expect(model.nodeTypes.get('End')!.outgoingEdges).toBeUndefined()
  })

  it('节点属性的路径是 data.properties 下的引擎键名，执行策略在 data 下；挂起型节点才有超时', () => {
    const model = createFlowModel(extensions)
    const paths = (type: string): string[] => (model.nodeTypes.get(type)!.properties ?? []).map(descriptor => formatJsonPath(descriptor.path))
    expect(paths('Http')).toEqual([
      'label',
      'data.properties.Url',
      'data.properties.Method',
      'data.properties.Headers',
      'data.properties.Body',
      'data.properties.ContentType',
      'data.properties.TimeoutSeconds',
      'data.properties.ResultVariable',
      'data.properties.FailOnErrorStatus',
      'data.continueOnError',
      'data.retryPolicy.maxAttempts',
      'data.retryPolicy.firstDelaySeconds',
      'data.retryPolicy.backoffFactor',
    ])
    expect(paths('UserTask')).toContain('data.timeoutSeconds')
    expect(paths('Start')).toEqual(['label'])
    expect(paths('Decision')).toEqual(['label'])
  })

  it('换文案生成另一份扩展：节点名、属性名与选项按中文显示', () => {
    const zh = createXihanWorkflow({ texts: xihanWorkflowZhCN })
    const model = createFlowModel([zh])
    const task = model.nodeTypes.get('UserTask')!
    const policy = task.properties!.find(descriptor => descriptor.path.at(-1) === 'CompletionPolicy')!
    expect([task.label, policy.label, policy.control]).toEqual(['人工任务', '通过规则', {
      kind: 'select',
      options: [{ value: 'Any', label: '任一人通过' }, { value: 'All', label: '全部通过' }, { value: 'Sequential', label: '依次审批' }],
    }])
    const partial = createXihanWorkflow({ texts: { activities: { UserTask: '审批' } } })
    expect(createFlowModel([partial]).nodeTypes.get('UserTask')!.label).toBe('审批')
    expect(createFlowModel([partial]).nodeTypes.get('Start')!.label).toBe('Start')
  })

  it('十种语言的文案与 UI 的语言包一一对应，每份都写全英文缺省的每个键', () => {
    const packs = Object.entries(presets).filter(([name]) => /^xihanWorkflow[A-Z][a-z][A-Z]{2}$/.test(name)) as [string, XihanWorkflowTexts][]
    expect(packs.map(([name]) => name).sort()).toEqual([
      'xihanWorkflowDeDE',
      'xihanWorkflowEnUS',
      'xihanWorkflowEsES',
      'xihanWorkflowFrFR',
      'xihanWorkflowJaJP',
      'xihanWorkflowKoKR',
      'xihanWorkflowPtBR',
      'xihanWorkflowRuRU',
      'xihanWorkflowZhCN',
      'xihanWorkflowZhTW',
    ])
    expect(xihanWorkflowEnUS).toBe(XIHAN_WORKFLOW_TEXTS)
    for (const [name, texts] of packs) {
      for (const section of Object.keys(XIHAN_WORKFLOW_TEXTS) as (keyof XihanWorkflowTexts)[]) {
        expect(Object.keys(texts[section]), `${name}.${section}`).toEqual(Object.keys(XIHAN_WORKFLOW_TEXTS[section]))
        for (const [key, text] of Object.entries(texts[section]))
          expect(text.trim(), `${name}.${section}.${key}`).not.toBe('')
      }
      const model = createFlowModel([createXihanWorkflow({ texts })])
      expect(XIHAN_WORKFLOW_ACTIVITY_TYPES.map(type => model.nodeTypes.get(type)!.label)).toEqual(XIHAN_WORKFLOW_ACTIVITY_TYPES.map(type => texts.activities[type]))
    }
  })
})

describe('xihanWorkflow 规则', () => {
  const named = { code: 'demo', name: 'Demo' }
  const node = (id: string, type: string, x: number, properties?: Record<string, unknown>) =>
    ({ id, type, x, y: 0, width: 160, height: 48, ...(properties ? { data: { properties } } : {}) }) as FlowDocument['nodes'][number]
  const edge = (id: string, source: string, target: string, data?: Record<string, unknown>) =>
    ({ id, source: { node: source }, target: { node: target }, ...(data ? { data } : {}) }) as FlowDocument['edges'][number]

  it('没有结束或终止节点时提醒', () => {
    const document: FlowDocument = { version: 1, data: named, nodes: [node('s', 'Start', 0), node('l', 'Log', 200)], edges: [edge('e', 's', 'l')] }
    expect(codes(document)).toContain('xihan-workflow.no-end@')
    const issue = validateDocument(document, { extensions }).find(item => item.code === 'xihan-workflow.no-end')!
    expect(issue.severity).toBe('warning')
    expect(createFlowModel(extensions).issueText(issue)).toBe('The workflow has no End or Terminate node')
  })

  it('条件分支：默认分支至多一条；有条件分支时要有默认或无条件分支兜底', () => {
    const base = [node('s', 'Start', 0), node('d', 'Decision', 200), node('a', 'End', 400), node('b', 'End', 400)]
    const twoDefaults: FlowDocument = {
      version: 1,
      data: named,
      nodes: base,
      edges: [edge('sd', 's', 'd'), edge('da', 'd', 'a', { isDefault: true }), edge('db', 'd', 'b', { isDefault: true })],
    }
    expect(codes(twoDefaults)).toContain('xihan-workflow.decision-multiple-defaults@d')
    const noFallback: FlowDocument = {
      version: 1,
      data: named,
      nodes: base,
      edges: [edge('sd', 's', 'd'), edge('da', 'd', 'a', { condition: 'x > 1' }), edge('db', 'd', 'b', { condition: 'x <= 1' })],
    }
    expect(codes(noFallback)).toContain('xihan-workflow.decision-no-default@d')
    const withFallback: FlowDocument = { ...noFallback, edges: [...noFallback.edges.slice(0, 2), edge('db', 'd', 'b')] }
    expect(codes(withFallback).filter(code => code.startsWith('xihan-workflow.decision'))).toEqual([])
  })

  it('人工任务要配受理人；与引擎一样，配了 Assignees 键（哪怕是空列表）就算配了', () => {
    const document = (properties?: Record<string, unknown>): FlowDocument => ({
      version: 1,
      data: named,
      nodes: [node('s', 'Start', 0), node('u', 'UserTask', 200, properties), node('e', 'End', 400)],
      edges: [edge('su', 's', 'u'), edge('ue', 'u', 'e')],
    })
    expect(codes(document())).toContain('xihan-workflow.user-task-no-assignee@u')
    expect(codes(document({ AssigneeRules: [] }))).toContain('xihan-workflow.user-task-no-assignee@u')
    expect(codes(document({ Assignees: [] }))).not.toContain('xihan-workflow.user-task-no-assignee@u')
    expect(codes(document({ AssigneesExpression: 'manager' }))).not.toContain('xihan-workflow.user-task-no-assignee@u')
    expect(codes(document({ AssigneeRules: [{ type: 'Starter', values: [] }] }))).toEqual([])
  })

  it('受理人规则的取值与兜底规则的必填', () => {
    const document = (properties: Record<string, unknown>): FlowDocument => ({
      version: 1,
      data: named,
      nodes: [node('s', 'Start', 0), node('u', 'UserTask', 200, properties), node('e', 'End', 400)],
      edges: [edge('su', 's', 'u'), edge('ue', 'u', 'e')],
    })
    const at = (issues: readonly FlowIssue[]): string[] => issues.map(issue => `${issue.code}@${formatJsonPath(issue.path)}`)
    expect(at(validateDocument(document({ AssigneeRules: [{ type: 'User', values: [] }] }), { extensions })))
      .toEqual(['invalid-value@nodes[1].data.properties.AssigneeRules'])
    expect(at(validateDocument(document({ AssigneeRules: [{ type: 'Expression', values: ['a', 'b'] }] }), { extensions })))
      .toEqual(['invalid-value@nodes[1].data.properties.AssigneeRules'])
    expect(at(validateDocument(document({ AssigneeRules: [{ type: 'Role', values: ['finance'] }], CcRules: 'x' }), { extensions })))
      .toEqual(['invalid-type@nodes[1].data.properties.CcRules'])
    expect(at(validateDocument(document({ AssigneeRules: [{ type: 'Starter' }], EmptyAssigneeStrategy: 'Fallback' }), { extensions })))
      .toEqual(['required@nodes[1].data.properties.FallbackAssigneeRules'])
  })

  it('启动变量的取值：变量名不能为空、不能重名，必填是布尔，类型与说明是字符串', () => {
    const document = (variables: unknown): FlowDocument => ({
      version: 1,
      data: { ...named, variables } as FlowDocument['data'],
      nodes: [node('s', 'Start', 0), node('e', 'End', 200)],
      edges: [edge('se', 's', 'e')],
    })
    const at = (variables: unknown): string[] => validateDocument(document(variables), { extensions }).map(issue => `${issue.code}@${formatJsonPath(issue.path)}`)
    expect(createFlowModel([xihanWorkflow]).documentProperties.find(descriptor => descriptor.path.at(-1) === 'variables')!.control)
      .toEqual({ kind: XIHAN_WORKFLOW_START_VARIABLES })
    expect(at([{ name: 'amount', required: true, defaultValue: 0, type: 'number', description: '金额' }, { name: 'note', defaultValue: null }])).toEqual([])
    expect(at({ name: 'amount' })).toEqual(['invalid-type@data.variables'])
    expect(at(['amount'])).toEqual(['invalid-value@data.variables'])
    expect(at([{ name: ' ' }])).toEqual(['empty@data.variables'])
    expect(at([{ required: true }])).toEqual(['empty@data.variables'])
    expect(at([{ name: 1 }])).toEqual(['invalid-value@data.variables'])
    expect(at([{ name: 'a', required: 'yes' }])).toEqual(['invalid-value@data.variables'])
    expect(at([{ name: 'a', description: 1 }])).toEqual(['invalid-value@data.variables'])
    expect(at([{ name: 'a' }, { name: 'a' }])).toEqual(['duplicate-key@data.variables'])
  })

  it('必填的引擎属性：延时的时长、HTTP 地址、脚本代码等', () => {
    const document: FlowDocument = {
      version: 1,
      data: named,
      nodes: [node('s', 'Start', 0), node('w', 'Delay', 200), node('h', 'Http', 400), node('e', 'End', 600)],
      edges: [edge('sw', 's', 'w'), edge('wh', 'w', 'h'), edge('he', 'h', 'e')],
    }
    expect(validateDocument(document, { extensions }).map(issue => formatJsonPath(issue.path)))
      .toEqual(['nodes[1].data.properties.DurationSeconds', 'nodes[2].data.properties.Url'])
  })
})

describe('与引擎定义互转', () => {
  it('引擎定义换成文档：坐标取 designerLayout，尺寸按类型，名称换标签，其余字段进 data，null 去掉', () => {
    const document = fromWorkflowDefinition(approval())
    expect(readDocument(document).ok).toBe(true)
    expect(document.nodes.find(item => item.id === 'manager')).toEqual({
      id: 'manager',
      type: 'UserTask',
      x: 200,
      y: 96,
      width: 160,
      height: 48,
      label: '主管审批',
      data: {
        properties: { AssigneeRules: [{ type: 'Starter', values: [] }], CompletionPolicy: 'Any', Title: '{{billNo}} 请假' },
        timeoutSeconds: 86400,
        continueOnError: false,
      },
    })
    expect(document.nodes[0]).toMatchObject({ x: 0, y: 100, width: 120, height: 40, data: { continueOnError: false } })
    expect(document.nodes[0]!.data).not.toHaveProperty('properties')
    expect(document.edges.find(item => item.id === 't4')).toEqual({ id: 't4', source: { node: 'days' }, target: { node: 'wait' }, label: '超过三天', data: { condition: 'days > 3', priority: 0 } })
    expect(document.data).toEqual({
      id: '7300000000000000001',
      code: 'leave',
      name: '请假审批',
      version: 2,
      category: 'hr',
      status: 'published',
      enableCompensation: false,
      variables: [{ name: 'days', type: 'number', required: true, defaultValue: null, description: null }],
      creationTime: '2026-10-01T08:00:00Z',
      extraProperties: { owner: 'hr' },
    })
    expect(codes(document)).toEqual([])
  })

  it('延时节点的数字时长换成字符串，引擎对两者同样处理', () => {
    const document = fromWorkflowDefinition(approval())
    expect(document.nodes.find(item => item.id === 'wait')!.data!.properties).toEqual({ DurationSeconds: '300' })
  })

  it('往返：文档换回定义后只差去掉的 null、空属性与改成字符串的时长；坐标写回 designerLayout', () => {
    const definition = toWorkflowDefinition(fromWorkflowDefinition(approval()))
    expect(definition.code).toBe('leave')
    expect(definition.nodes![0]).toEqual({ id: 'start', name: '提交', activityType: 'Start', continueOnError: false, properties: {} })
    expect(definition.nodes![3]).toEqual({
      id: 'wait',
      name: '缓冲',
      activityType: 'Delay',
      properties: { DurationSeconds: '300' },
      retryPolicy: { maxAttempts: 3, firstDelaySeconds: 10, backoffFactor: 2 },
    })
    expect(definition.transitions![0]).toEqual({ id: 't1', sourceNodeId: 'start', targetNodeId: 'manager', priority: 0, isDefault: false })
    expect(definition.transitions![3]).toEqual({ id: 't4', name: '超过三天', sourceNodeId: 'days', targetNodeId: 'wait', condition: 'days > 3', priority: 0 })
    expect(definition.extraProperties).toEqual({ owner: 'hr', designerLayout: approval().extraProperties!.designerLayout })
    expect(toWorkflowDefinition(fromWorkflowDefinition(definition))).toEqual(definition)
  })

  it('连线的拐点、外观与各扩展的数据经 designerEdges、designerExtensions 往返', () => {
    const base = fromWorkflowDefinition(approval())
    const document: FlowDocument = {
      ...base,
      extensions: { '@acme/sim': { runs: 3 } },
      nodes: base.nodes.map(item => item.id === 'days' ? { ...item, extensions: { '@acme/sim': { weight: 2 } } } : item),
      edges: base.edges.map(item => item.id === 't5' ? { ...item, style: { dashed: true }, vertices: [{ x: 500, y: 200 }], extensions: { '@acme/sim': {} } } : item),
    }
    const definition = toWorkflowDefinition(document)
    expect(JSON.parse(definition.extraProperties!.designerEdges!)).toEqual({ t5: { vertices: [{ x: 500, y: 200 }], style: { dashed: true } } })
    expect(fromWorkflowDefinition(definition)).toEqual(document)
  })

  it('条件分支的默认分支按 isDefault 画成虚线：没有 designerEdges 也推得出，推出的外观不写回定义', () => {
    const decision = createFlowModel(extensions).nodeTypes.get('Decision')
    const document = fromWorkflowDefinition(approval())
    const dashed = (doc: FlowDocument, id: string): boolean | undefined => resolveEdgeStyle(doc.edges.find(item => item.id === id)!, decision).dashed
    expect([dashed(document, 't4'), dashed(document, 't5')]).toEqual([undefined, true])
    expect(document.edges.find(item => item.id === 't5')!.style).toBeUndefined()

    const once = toWorkflowDefinition(document)
    const twice = toWorkflowDefinition(fromWorkflowDefinition(once))
    expect([once.extraProperties!.designerEdges, twice.extraProperties!.designerEdges]).toEqual([undefined, undefined])
    expect(twice).toEqual(once)

    const solid = { ...document, edges: document.edges.map(item => item.id === 't5' ? { ...item, style: { dashed: false } } : item) }
    expect(dashed(solid, 't5')).toBe(false)
    expect(JSON.parse(toWorkflowDefinition(solid).extraProperties!.designerEdges!)).toEqual({ t5: { style: { dashed: false } } })
  })

  it('legacyAssignees 为 false 时审批节点不登记旧的受理人写法，已有的值照旧读写、往返不丢', () => {
    const LEGACY = ['data.properties.Assignees', 'data.properties.AssigneesExpression', 'data.properties.CcUserIds']
    const paths = (extension: typeof xihanWorkflow): string[] =>
      createFlowModel([extension]).nodeTypes.get('UserTask')!.properties!.map(property => formatJsonPath(property.path))
    expect(paths(xihanWorkflow)).toEqual(expect.arrayContaining(LEGACY))
    const modern = createXihanWorkflow({ legacyAssignees: false })
    expect(paths(modern).filter(path => LEGACY.includes(path))).toEqual([])
    expect(paths(modern)).toContain('data.properties.AssigneeRules')

    const legacyValues = { Assignees: ['u1'], AssigneesExpression: 'starter.manager', CcUserIds: ['u2'] }
    const definition = { ...approval(), nodes: approval().nodes!.map(item => item.id === 'manager' ? { ...item, properties: { ...item.properties, ...legacyValues } } : item) }
    const document = fromWorkflowDefinition(definition)
    expect(validateDocument(document, { extensions: [modern] }).filter(issue => LEGACY.some(path => formatJsonPath(issue.path).endsWith(path)))).toEqual([])
    const once = toWorkflowDefinition(document)
    expect(once.nodes!.find(item => item.id === 'manager')!.properties).toMatchObject(legacyValues)
    expect(toWorkflowDefinition(fromWorkflowDefinition(once))).toEqual(once)
  })

  it('没有坐标的节点按连线自左向右排开；连线缺 id 时补上', () => {
    const document = fromWorkflowDefinition({ ...approval(), extraProperties: {}, transitions: approval().transitions!.map(transition => ({ ...transition, id: undefined })) })
    const x = (id: string): number => document.nodes.find(item => item.id === id)!.x
    expect(x('start')).toBeLessThan(x('manager'))
    expect(x('manager')).toBeLessThan(x('days'))
    expect(x('days')).toBeLessThan(x('wait'))
    expect(document.edges.map(item => item.id)).toEqual(['start->manager#1', 'manager->days#2', 'manager->rejected#3', 'days->wait#4', 'days->approved#5', 'wait->approved#6'])

    const partial = fromWorkflowDefinition({ ...approval(), extraProperties: { designerLayout: JSON.stringify({ start: { x: 7, y: 9 } }) } })
    expect(partial.nodes[0]).toMatchObject({ x: 7, y: 9 })
    const broken = fromWorkflowDefinition({ ...approval(), extraProperties: { designerLayout: '{' } })
    expect(broken.nodes.map(item => item.id)).toHaveLength(6)
  })

  it('结构不对时抛 TypeError', () => {
    expect(() => fromWorkflowDefinition(null as unknown as XihanWorkflowDefinition)).toThrow(TypeError)
    expect(() => fromWorkflowDefinition({ nodes: {} as unknown as [] })).toThrow(/nodes must be an array/)
    expect(() => fromWorkflowDefinition({ nodes: [{ id: 'a' } as never] })).toThrow(/nodes\[0\]/)
    expect(() => fromWorkflowDefinition({ transitions: [{ sourceNodeId: 'a' } as never] })).toThrow(/transitions\[0\]/)
  })
})
