/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from './json'

/** 问题严重程度。 */
export type FlowIssueSeverity = 'error' | 'warning'

/** 读取未知输入时的结构问题码。 */
export type FlowSchemaIssueCode
  = | 'schema.type-mismatch'
    | 'schema.missing-field'
    | 'schema.unknown-field'
    | 'document.unsupported-version'

/** 按节点类型登记表校验文档时的问题码。 */
export type FlowValidationIssueCode
  = | 'node.duplicate-id'
    | 'node.unknown-type'
    | 'edge.duplicate-id'
    | 'edge.dangling'
    | 'edge.unknown-port'
    | 'edge.invalid-direction'
    | 'edge.self-loop'
    | 'edge.target-not-allowed'
    | 'edge.source-not-allowed'
    | 'node.max-incoming'
    | 'node.max-outgoing'
    | 'port.max-connections'
    | 'type.min-count'
    | 'type.max-count'
    | 'node.isolated'
    | 'node.missing-incoming'
    | 'node.missing-outgoing'
    | 'node.unreachable'
    | 'node.property-required'

/** 全部问题码。 */
export type FlowIssueCode = FlowSchemaIssueCode | FlowValidationIssueCode

/** 连线的一端。 */
export type FlowEdgeEnd = 'source' | 'target'

/** 问题定位：文档、节点或连线；index 为在对应数组中的下标。 */
export type FlowIssueLocation
  = | { readonly kind: 'document' }
    | { readonly kind: 'node', readonly id: string, readonly index: number }
    | { readonly kind: 'edge', readonly id: string, readonly index: number, readonly end?: FlowEdgeEnd }

/** 一条问题：只含问题码、严重程度、定位与参数，文案由使用方按问题码生成。 */
export interface FlowIssue {
  readonly code: FlowIssueCode
  readonly severity: FlowIssueSeverity
  readonly location: FlowIssueLocation
  readonly params: JsonObject
}
