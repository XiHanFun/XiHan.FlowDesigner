/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @xihan-flow/core/presets/xihan-workflow：XiHan.Framework.Workflow 引擎的节点预设。
// 17 种活动对应的节点类型、按源节点类型的出线属性、流程定义级属性、引擎发布时把关的规则，以及与引擎定义 JSON 的互转。

import type { FlowCoreExtension } from '../../extensions'
import type { XihanWorkflowTexts, XihanWorkflowTextsOverride } from './texts'
import { XIHAN_WORKFLOW_ASSIGNEE_RULES, xihanWorkflowDocumentProperties, xihanWorkflowNodeTypes } from './activities'
import { ASSIGNEE_RULES_CONTROL, XIHAN_WORKFLOW_RULES } from './rules'
import { XIHAN_WORKFLOW_TEXTS } from './texts'

export { XIHAN_WORKFLOW_ASSIGNEE_RULES, xihanWorkflowNodeSize, xihanWorkflowPropertyKeys } from './activities'
export { fromWorkflowDefinition, toWorkflowDefinition } from './definition'
export type { FromWorkflowDefinitionOptions, XihanWorkflowDefinition, XihanWorkflowNode, XihanWorkflowTransition } from './definition'
export { XIHAN_WORKFLOW_ACTIVITY_TYPES, XIHAN_WORKFLOW_TEXTS, xihanWorkflowZhCN } from './texts'
export type {
  XihanWorkflowActivityType,
  XihanWorkflowCategory,
  XihanWorkflowGroup,
  XihanWorkflowIssueCode,
  XihanWorkflowOptionKey,
  XihanWorkflowPropertyKey,
  XihanWorkflowTexts,
  XihanWorkflowTextsOverride,
} from './texts'

/** 预设的扩展 id；规则的问题码以 xihan-workflow. 开头。 */
export const XIHAN_WORKFLOW_ID = '@xihan-flow/xihan-workflow'

export interface CreateXihanWorkflowOptions {
  /** 文案，各部分按键覆盖英文缺省；中文直接传 xihanWorkflowZhCN。 */
  readonly texts?: XihanWorkflowTextsOverride
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
 * 受理人规则的编辑方式是 XIHAN_WORKFLOW_ASSIGNEE_RULES，编辑器由宿主经设计器扩展的 editors.byControl 提供。
 */
export function createXihanWorkflow(options: CreateXihanWorkflowOptions = {}): FlowCoreExtension {
  const texts = mergeTexts(options.texts)
  const messages: Readonly<Record<string, string>> = texts.issues
  return {
    id: XIHAN_WORKFLOW_ID,
    nodeTypes: xihanWorkflowNodeTypes(texts),
    documentProperties: xihanWorkflowDocumentProperties(texts),
    controls: { [XIHAN_WORKFLOW_ASSIGNEE_RULES]: ASSIGNEE_RULES_CONTROL },
    rules: XIHAN_WORKFLOW_RULES,
    issueText: issue => (Object.hasOwn(messages, issue.code) ? messages[issue.code] : undefined),
  }
}

/** 英文文案的预设扩展。 */
export const xihanWorkflow: FlowCoreExtension = /* @__PURE__ */ createXihanWorkflow()
