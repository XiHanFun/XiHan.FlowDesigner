/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// XiHan 工作流预设的文案类型与英文缺省；各语言的文案在 locale/ 下。

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

/** 引擎内置的活动类型名。 */
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

/**
 * 规则问题说明的键：问题码，外加同一条问题随预设选项换用的说明。
 * xihan-workflow.user-task-no-assignee-rules 是 legacyAssignees 为 false 时缺受理人那条问题的说明，只提受理人规则。
 */
export type XihanWorkflowIssueTextKey = XihanWorkflowIssueCode | 'xihan-workflow.user-task-no-assignee-rules'

/** 预设的全部文案。 */
export interface XihanWorkflowTexts {
  /** 节点类型的显示名，键是活动类型。 */
  readonly activities: Readonly<Record<XihanWorkflowActivityType, string>>
  /** 交给设计器的 paletteGroupLabels。 */
  readonly categories: Readonly<Record<XihanWorkflowCategory, string>>
  /** 交给设计器的 propertyGroupLabels。 */
  readonly groups: Readonly<Record<XihanWorkflowGroup, string>>
  /** 属性的标签。 */
  readonly properties: Readonly<Record<XihanWorkflowPropertyKey, string>>
  /** 下拉选项的文字。 */
  readonly options: Readonly<Record<XihanWorkflowOptionKey, string>>
  /** 规则问题的说明，键见 XihanWorkflowIssueTextKey。 */
  readonly issues: Readonly<Record<XihanWorkflowIssueTextKey, string>>
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
    'xihan-workflow.user-task-no-assignee-rules': 'Set assignee rules',
  },
}
