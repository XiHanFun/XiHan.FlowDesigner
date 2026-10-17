/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// XiHan 工作流预设的文案：英文缺省一份，中文一份 xihanWorkflowZhCN。

/** 引擎内置的活动类型，与 XiHan.Framework.Workflow 的 WorkflowActivityTypes 一一对应。 */
export const XIHAN_WORKFLOW_ACTIVITY_TYPES = [
  'Start',
  'End',
  'Terminate',
  'SetVariable',
  'Decision',
  'Parallel',
  'Join',
  'Delay',
  'UserTask',
  'Http',
  'Script',
  'PublishEvent',
  'WaitSignal',
  'SubWorkflow',
  'ForEach',
  'Log',
  'Fault',
] as const

export type XihanWorkflowActivityType = typeof XIHAN_WORKFLOW_ACTIVITY_TYPES[number]

/** 物料面板的分类，节点类型的 category 取这些值。 */
export type XihanWorkflowCategory = 'control' | 'human' | 'data' | 'integration' | 'event' | 'tool'

/** 属性面板的分组，属性描述的 group 取这些值。 */
export type XihanWorkflowGroup = 'basic' | 'participants' | 'form' | 'execution'

/**
 * 属性名的键：节点属性用引擎的键名（Title、Url…），节点级字段与连线、流程定义的字段用 JSON 里的字段名，
 * 名称（节点名与连线名）为 name。
 */
export type XihanWorkflowPropertyKey
  = | 'name'
    | 'Outcome'
    | 'Reason'
    | 'Message'
    | 'Values'
    | 'Expressions'
    | 'Mode'
    | 'DurationSeconds'
    | 'Title'
    | 'AssigneeRules'
    | 'Assignees'
    | 'AssigneesExpression'
    | 'ExcludeStarter'
    | 'CompletionPolicy'
    | 'EmptyAssigneeStrategy'
    | 'FallbackAssigneeRules'
    | 'CcRules'
    | 'CcUserIds'
    | 'FormData'
    | 'AllowedOutcomes'
    | 'Url'
    | 'Method'
    | 'Headers'
    | 'Body'
    | 'ContentType'
    | 'TimeoutSeconds'
    | 'ResultVariable'
    | 'FailOnErrorStatus'
    | 'Code'
    | 'EventName'
    | 'Payload'
    | 'SignalName'
    | 'AcceptAnyCorrelation'
    | 'DefinitionCode'
    | 'DefinitionVersion'
    | 'Variables'
    | 'VariableExpressions'
    | 'WaitForCompletion'
    | 'FailOnChildFault'
    | 'ItemsExpression'
    | 'ItemVariableName'
    | 'Parallel'
    | 'FailFast'
    | 'Level'
    | 'timeoutSeconds'
    | 'continueOnError'
    | 'retryPolicy.maxAttempts'
    | 'retryPolicy.firstDelaySeconds'
    | 'retryPolicy.backoffFactor'
    | 'condition'
    | 'priority'
    | 'isDefault'
    | 'code'
    | 'description'
    | 'category'
    | 'enableCompensation'
    | 'variables'

/** 下拉选项的键：属性键加点加取值，只列需要翻译的。 */
export type XihanWorkflowOptionKey
  = | 'Outcome.approved'
    | 'Outcome.rejected'
    | 'Mode.WaitAll'
    | 'Mode.WaitAny'
    | 'CompletionPolicy.Any'
    | 'CompletionPolicy.All'
    | 'CompletionPolicy.Sequential'
    | 'EmptyAssigneeStrategy.Fault'
    | 'EmptyAssigneeStrategy.AutoApprove'
    | 'EmptyAssigneeStrategy.AutoReject'
    | 'EmptyAssigneeStrategy.Fallback'
    | 'Level.Debug'
    | 'Level.Information'
    | 'Level.Warning'
    | 'Level.Error'

/** 预设规则的问题码。 */
export type XihanWorkflowIssueCode
  = | 'xihan-workflow.no-end'
    | 'xihan-workflow.decision-multiple-defaults'
    | 'xihan-workflow.decision-no-default'
    | 'xihan-workflow.user-task-no-assignee'

/** 预设的全部文案。 */
export interface XihanWorkflowTexts {
  readonly activities: Readonly<Record<XihanWorkflowActivityType, string>>
  /** 交给设计器的 paletteGroupLabels。 */
  readonly categories: Readonly<Record<XihanWorkflowCategory, string>>
  /** 交给设计器的 propertyGroupLabels。 */
  readonly groups: Readonly<Record<XihanWorkflowGroup, string>>
  readonly properties: Readonly<Record<XihanWorkflowPropertyKey, string>>
  readonly options: Readonly<Record<XihanWorkflowOptionKey, string>>
  readonly issues: Readonly<Record<XihanWorkflowIssueCode, string>>
}

/** 覆盖部分文案：各部分分别按键覆盖英文缺省。 */
export type XihanWorkflowTextsOverride = { readonly [K in keyof XihanWorkflowTexts]?: Partial<XihanWorkflowTexts[K]> }

/** 英文缺省文案。 */
export const XIHAN_WORKFLOW_TEXTS: XihanWorkflowTexts = {
  activities: {
    Start: 'Start',
    End: 'End',
    Terminate: 'Terminate',
    SetVariable: 'Set variables',
    Decision: 'Decision',
    Parallel: 'Parallel',
    Join: 'Join',
    Delay: 'Delay',
    UserTask: 'User task',
    Http: 'HTTP request',
    Script: 'Script',
    PublishEvent: 'Publish event',
    WaitSignal: 'Wait for signal',
    SubWorkflow: 'Sub-workflow',
    ForEach: 'For each',
    Log: 'Log',
    Fault: 'Fault',
  },
  categories: {
    control: 'Flow control',
    human: 'Human',
    data: 'Data',
    integration: 'Integration',
    event: 'Events',
    tool: 'Tools',
  },
  groups: {
    basic: 'Basic',
    participants: 'Participants',
    form: 'Form',
    execution: 'Execution',
  },
  properties: {
    'name': 'Name',
    'Outcome': 'Outcome',
    'Reason': 'Reason',
    'Message': 'Message',
    'Values': 'Values',
    'Expressions': 'Expressions',
    'Mode': 'Mode',
    'DurationSeconds': 'Duration (s)',
    'Title': 'Task title',
    'AssigneeRules': 'Assignee rules',
    'Assignees': 'Assignees',
    'AssigneesExpression': 'Assignees expression',
    'ExcludeStarter': 'Exclude starter',
    'CompletionPolicy': 'Completion policy',
    'EmptyAssigneeStrategy': 'When no assignee',
    'FallbackAssigneeRules': 'Fallback assignee rules',
    'CcRules': 'CC rules',
    'CcUserIds': 'CC users',
    'FormData': 'Form data',
    'AllowedOutcomes': 'Allowed outcomes',
    'Url': 'URL',
    'Method': 'Method',
    'Headers': 'Headers',
    'Body': 'Body',
    'ContentType': 'Content type',
    'TimeoutSeconds': 'Request timeout (s)',
    'ResultVariable': 'Result variable',
    'FailOnErrorStatus': 'Fail on error status',
    'Code': 'Code',
    'EventName': 'Event name',
    'Payload': 'Payload',
    'SignalName': 'Signal name',
    'AcceptAnyCorrelation': 'Accept any correlation',
    'DefinitionCode': 'Workflow code',
    'DefinitionVersion': 'Workflow version',
    'Variables': 'Variables',
    'VariableExpressions': 'Variable expressions',
    'WaitForCompletion': 'Wait for completion',
    'FailOnChildFault': 'Fail on child fault',
    'ItemsExpression': 'Items expression',
    'ItemVariableName': 'Item variable',
    'Parallel': 'Run in parallel',
    'FailFast': 'Fail fast',
    'Level': 'Level',
    'timeoutSeconds': 'Timeout (s)',
    'continueOnError': 'Continue on error',
    'retryPolicy.maxAttempts': 'Max attempts',
    'retryPolicy.firstDelaySeconds': 'First retry delay (s)',
    'retryPolicy.backoffFactor': 'Backoff factor',
    'condition': 'Condition',
    'priority': 'Priority',
    'isDefault': 'Default branch',
    'code': 'Code',
    'description': 'Description',
    'category': 'Category',
    'enableCompensation': 'Enable compensation',
    'variables': 'Start variables',
  },
  options: {
    'Outcome.approved': 'Approved',
    'Outcome.rejected': 'Rejected',
    'Mode.WaitAll': 'Wait for all',
    'Mode.WaitAny': 'Wait for any',
    'CompletionPolicy.Any': 'Any one approves',
    'CompletionPolicy.All': 'All approve',
    'CompletionPolicy.Sequential': 'In sequence',
    'EmptyAssigneeStrategy.Fault': 'Fault',
    'EmptyAssigneeStrategy.AutoApprove': 'Approve automatically',
    'EmptyAssigneeStrategy.AutoReject': 'Reject automatically',
    'EmptyAssigneeStrategy.Fallback': 'Hand to fallback assignees',
    'Level.Debug': 'Debug',
    'Level.Information': 'Information',
    'Level.Warning': 'Warning',
    'Level.Error': 'Error',
  },
  issues: {
    'xihan-workflow.no-end': 'The workflow has no End or Terminate node',
    'xihan-workflow.decision-multiple-defaults': 'A decision can have at most one default branch',
    'xihan-workflow.decision-no-default': 'Add a default branch or an unconditional branch',
    'xihan-workflow.user-task-no-assignee': 'Set assignee rules, assignees or an assignees expression',
  },
}

/** 中文文案。 */
export const xihanWorkflowZhCN: XihanWorkflowTexts = {
  activities: {
    Start: '开始',
    End: '结束',
    Terminate: '终止',
    SetVariable: '设置变量',
    Decision: '条件分支',
    Parallel: '并行分支',
    Join: '汇聚',
    Delay: '延时',
    UserTask: '人工任务',
    Http: 'HTTP 请求',
    Script: '脚本',
    PublishEvent: '发布事件',
    WaitSignal: '等待信号',
    SubWorkflow: '子流程',
    ForEach: '遍历',
    Log: '日志',
    Fault: '抛出故障',
  },
  categories: {
    control: '流程控制',
    human: '人工',
    data: '数据',
    integration: '集成',
    event: '事件',
    tool: '工具',
  },
  groups: {
    basic: '基本',
    participants: '参与人',
    form: '表单',
    execution: '执行',
  },
  properties: {
    'name': '名称',
    'Outcome': '流程结果',
    'Reason': '终止原因',
    'Message': '内容',
    'Values': '固定值',
    'Expressions': '表达式',
    'Mode': '汇聚方式',
    'DurationSeconds': '时长（秒）',
    'Title': '待办标题',
    'AssigneeRules': '受理人规则',
    'Assignees': '受理人',
    'AssigneesExpression': '受理人表达式',
    'ExcludeStarter': '排除发起人',
    'CompletionPolicy': '通过规则',
    'EmptyAssigneeStrategy': '没有受理人时',
    'FallbackAssigneeRules': '兜底受理人规则',
    'CcRules': '抄送规则',
    'CcUserIds': '抄送人',
    'FormData': '表单数据',
    'AllowedOutcomes': '可选办理结果',
    'Url': '地址',
    'Method': '请求方法',
    'Headers': '请求头',
    'Body': '请求体',
    'ContentType': '内容类型',
    'TimeoutSeconds': '请求超时（秒）',
    'ResultVariable': '结果变量',
    'FailOnErrorStatus': '错误状态码时失败',
    'Code': '代码',
    'EventName': '事件名',
    'Payload': '事件数据',
    'SignalName': '信号名',
    'AcceptAnyCorrelation': '接受任意关联',
    'DefinitionCode': '流程编码',
    'DefinitionVersion': '流程版本',
    'Variables': '变量',
    'VariableExpressions': '变量表达式',
    'WaitForCompletion': '等待完成',
    'FailOnChildFault': '子流程故障时失败',
    'ItemsExpression': '集合表达式',
    'ItemVariableName': '元素变量名',
    'Parallel': '并行执行',
    'FailFast': '一项失败即停止',
    'Level': '级别',
    'timeoutSeconds': '超时（秒）',
    'continueOnError': '失败后继续',
    'retryPolicy.maxAttempts': '最多尝试次数',
    'retryPolicy.firstDelaySeconds': '首次重试等待（秒）',
    'retryPolicy.backoffFactor': '退避倍率',
    'condition': '条件',
    'priority': '优先级',
    'isDefault': '默认分支',
    'code': '流程编码',
    'description': '描述',
    'category': '分类',
    'enableCompensation': '启用补偿',
    'variables': '启动变量',
  },
  options: {
    'Outcome.approved': '通过',
    'Outcome.rejected': '驳回',
    'Mode.WaitAll': '等待全部',
    'Mode.WaitAny': '任一到达',
    'CompletionPolicy.Any': '任一人通过',
    'CompletionPolicy.All': '全部通过',
    'CompletionPolicy.Sequential': '依次审批',
    'EmptyAssigneeStrategy.Fault': '报错',
    'EmptyAssigneeStrategy.AutoApprove': '自动通过',
    'EmptyAssigneeStrategy.AutoReject': '自动驳回',
    'EmptyAssigneeStrategy.Fallback': '转交兜底受理人',
    'Level.Debug': '调试',
    'Level.Information': '信息',
    'Level.Warning': '警告',
    'Level.Error': '错误',
  },
  issues: {
    'xihan-workflow.no-end': '流程没有结束或终止节点',
    'xihan-workflow.decision-multiple-defaults': '条件分支至多一条默认分支',
    'xihan-workflow.decision-no-default': '加一条默认分支或无条件分支',
    'xihan-workflow.user-task-no-assignee': '配置受理人规则、受理人或受理人表达式',
  },
}
