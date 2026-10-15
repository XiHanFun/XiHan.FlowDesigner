/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihanfun/flow-core 的公共接口。

export type { FlowEdgeEnd, FlowIssue, FlowIssueCode, FlowIssueLocation, FlowIssueSeverity, FlowSchemaIssueCode, FlowValidationIssueCode } from './issues'
export { appendPointer, cloneJson, encodePointerToken, findJsonViolation, isJsonValue, isPlainObject, jsonEquals } from './json'
export type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from './json'
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
export { evaluateCondition, getDataValue, groupProperties, isFilled, isPropertyVisible, setDataValue } from './properties'
export type { FlowDataPath, FlowPropertyCondition, FlowPropertyDescriptor, FlowPropertyGroup, FlowPropertyOption } from './properties'
export { readDocument } from './read'
export type { FlowReadResult, FlowSchemaExpectation } from './read'
export { createNode, createNodeTypeRegistry, findPort, getPortPosition, portAllows } from './registry'
export type {
  FlowConnectionRule,
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
} from './registry'
export { createDocument, FLOW_DOCUMENT_VERSION } from './schema'
export type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowEndpoint, FlowNode, FlowPoint, FlowRect, FlowSize } from './schema'
export { checkConnection, DEFAULT_ISSUE_SEVERITY, resolveEndpointPort, validateDocument } from './validate'
export type { FlowConnectionCheckOptions, FlowConnectionIssueCode, FlowConnectionProblem, FlowValidateOptions } from './validate'
