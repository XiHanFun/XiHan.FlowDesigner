/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihanfun/flow-core 的公共接口。

export type { FlowEdgeEnd, FlowIssue, FlowIssueCode, FlowIssueLocation, FlowIssueSeverity, FlowSchemaIssueCode, FlowValidationIssueCode } from './issues'
export { appendPointer, cloneJson, encodePointerToken, findJsonViolation, isJsonValue, isPlainObject, jsonEquals } from './json'
export type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from './json'
export { readDocument } from './read'
export type { FlowReadResult, FlowSchemaExpectation } from './read'
export { createDocument, FLOW_DOCUMENT_VERSION } from './schema'
export type { FlowDocument, FlowEdge, FlowEdgeStyle, FlowEndpoint, FlowNode, FlowPoint, FlowRect, FlowSize } from './schema'
