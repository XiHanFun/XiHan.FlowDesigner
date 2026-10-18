/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-flow/core 的公共接口。

export { createFlowModel, FLOW_CORE_EXTENSION, FLOW_EXTENSION_SPACES, patchExtensionData } from './extensions'
export type { FlowCoreExtension, FlowModel, FlowRuleContext } from './extensions'
export { computeEdgeGeometry, resolveEdgeAnchor } from './geometry'
export type { FlowEdgeAnchor, FlowEdgeGeometry, FlowEdgeRouter, FlowRouteRequest } from './geometry'
export type { FlowEdgeEnd, FlowIssue, FlowIssueCode, FlowSchemaIssueCode, FlowValidationIssueCode } from './issues'
export { applyOperation, applyOperations, FlowOperationError } from './operations'
export type {
  FlowDocumentPatch,
  FlowEdgePatch,
  FlowNodePatch,
  FlowNodePosition,
  FlowOperation,
  FlowOperationErrorCode,
  FlowOperationResult,
  FlowOperationType,
} from './operations'
export { readDocument } from './read'
export type { FlowReadResult } from './read'
export { createNode, createNodeTypeRegistry, findPort, getPortPosition, portAllows, resolveEdgeStyle } from './registry'
export type {
  FlowConnectionRule,
  FlowEdgeStyleRule,
  FlowNodeDefaults,
  FlowNodeInit,
  FlowNodeType,
  FlowNodeTypeDefinition,
  FlowNodeTypeRegistry,
  FlowPort,
  FlowPortDefinition,
  FlowPortDirection,
  FlowPortPreset,
  FlowPortSide,
  FlowPropertyControl,
  FlowPropertyDescriptor,
} from './registry'
export { createDocument, FLOW_DOCUMENT_VERSION } from './schema'
export type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowEndpoint, FlowNode, FlowPoint, FlowRect, FlowSize } from './schema'
export { checkConnection, DEFAULT_ISSUE_SEVERITY, resolveEndpointPort, validateDocument } from './validate'
export type { FlowConnectionCheckOptions, FlowConnectionIssueCode, FlowConnectionProblem, FlowValidateOptions } from './validate'
