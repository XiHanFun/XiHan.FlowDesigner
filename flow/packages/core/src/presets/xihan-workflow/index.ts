/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @xihan-flow/core/presets/xihan-workflow：XiHan.Framework.Workflow 引擎的节点预设。
// 17 种活动对应的节点类型、按源节点类型的出线属性、流程定义级属性、引擎发布时把关的规则，以及与引擎定义 JSON 的互转。

import type { FlowCoreExtension } from '../../extensions'
import type { XihanWorkflowTexts, XihanWorkflowTextsOverride } from './texts'
import { XIHAN_WORKFLOW_ASSIGNEE_RULES, XIHAN_WORKFLOW_START_VARIABLES, xihanWorkflowDocumentProperties, xihanWorkflowNodeTypes } from './activities'
import { ASSIGNEE_RULES_CONTROL, START_VARIABLES_CONTROL, XIHAN_WORKFLOW_RULES } from './rules'
import { XIHAN_WORKFLOW_TEXTS } from './texts'

export { XIHAN_WORKFLOW_ASSIGNEE_RULES, XIHAN_WORKFLOW_START_VARIABLES, xihanWorkflowNodeSize, xihanWorkflowPropertyKeys } from './activities'
export { fromWorkflowDefinition, toWorkflowDefinition } from './definition'
export type { FromWorkflowDefinitionOptions, XihanWorkflowDefinition, XihanWorkflowNode, XihanWorkflowTransition } from './definition'
export { xihanWorkflowDeDE } from './locale/de-DE'
export { xihanWorkflowEnUS } from './locale/en-US'
export { xihanWorkflowEsES } from './locale/es-ES'
export { xihanWorkflowFrFR } from './locale/fr-FR'
export { xihanWorkflowJaJP } from './locale/ja-JP'
export { xihanWorkflowKoKR } from './locale/ko-KR'
export { xihanWorkflowPtBR } from './locale/pt-BR'
export { xihanWorkflowRuRU } from './locale/ru-RU'
export { xihanWorkflowZhCN } from './locale/zh-CN'
export { xihanWorkflowZhTW } from './locale/zh-TW'
export { XIHAN_WORKFLOW_ACTIVITY_TYPES, XIHAN_WORKFLOW_TEXTS } from './texts'
export type {
  XihanWorkflowActivityType,
  XihanWorkflowCategory,
  XihanWorkflowGroup,
  XihanWorkflowIssueCode,
  XihanWorkflowIssueTextKey,
  XihanWorkflowOptionKey,
  XihanWorkflowPropertyKey,
  XihanWorkflowTexts,
  XihanWorkflowTextsOverride,
} from './texts'

/** 预设的扩展 id；规则的问题码以 xihan-workflow. 开头。 */
export const XIHAN_WORKFLOW_ID = '@xihan-flow/xihan-workflow'

/** createXihanWorkflow 的选项。 */
export interface CreateXihanWorkflowOptions {
  /** 文案，各部分按键覆盖英文缺省；整套换语言直接传对应的语言包，如 xihanWorkflowZhCN、xihanWorkflowJaJP。 */
  readonly texts?: XihanWorkflowTextsOverride
  /**
   * 审批节点的属性面板里显示旧的受理人写法（Assignees、AssigneesExpression、CcUserIds），缺省 true。
   * 为 false 时不登记这三项属性，已有的值照旧读写、往返不丢，只是属性面板里不再显示；缺受理人的问题说明也只提受理人规则。
   */
  readonly legacyAssignees?: boolean
}

function mergeTexts(override: XihanWorkflowTextsOverride | undefined): XihanWorkflowTexts {
  if (!override)
    return XIHAN_WORKFLOW_TEXTS
  const base = XIHAN_WORKFLOW_TEXTS
  return {
    activities: { ...base.activities, ...override.activities },
    categories: { ...base.categories, ...override.categories },
    groups: { ...base.groups, ...override.groups },
    properties: { ...base.properties, ...override.properties },
    options: { ...base.options, ...override.options },
    issues: { ...base.issues, ...override.issues },
  }
}

/**
 * 按文案生成预设扩展。节点类型与属性的文字写在扩展里，换语言就换一个扩展对象（同一个 id，按卸下再装上处理）；
 * 物料分类与属性分组的文字交给设计器的 paletteGroupLabels、propertyGroupLabels。
 * 受理人规则的编辑方式是 XIHAN_WORKFLOW_ASSIGNEE_RULES，编辑器由宿主经设计器扩展的 editors.byControl 提供；
 * 启动变量的编辑方式是 XIHAN_WORKFLOW_START_VARIABLES，设计器内建它的编辑器，宿主同样可以按种类换掉。
 */
export function createXihanWorkflow(options: CreateXihanWorkflowOptions = {}): FlowCoreExtension {
  const texts = mergeTexts(options.texts)
  const messages: Readonly<Record<string, string>> = texts.issues
  const legacy = options.legacyAssignees ?? true
  return {
    id: XIHAN_WORKFLOW_ID,
    nodeTypes: xihanWorkflowNodeTypes(texts, { legacyAssignees: options.legacyAssignees }),
    documentProperties: xihanWorkflowDocumentProperties(texts),
    controls: { [XIHAN_WORKFLOW_ASSIGNEE_RULES]: ASSIGNEE_RULES_CONTROL, [XIHAN_WORKFLOW_START_VARIABLES]: START_VARIABLES_CONTROL },
    rules: XIHAN_WORKFLOW_RULES,
    issueText: (issue) => {
      // 不登记旧的受理人写法时，缺受理人的说明只提受理人规则
      const key = !legacy && issue.code === 'xihan-workflow.user-task-no-assignee' ? 'xihan-workflow.user-task-no-assignee-rules' : issue.code
      return Object.hasOwn(messages, key) ? messages[key] : undefined
    },
  }
}

/** 英文文案的预设扩展。 */
export const xihanWorkflow: FlowCoreExtension = /* @__PURE__ */ createXihanWorkflow()
