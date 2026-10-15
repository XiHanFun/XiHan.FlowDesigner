/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { PropertyValueIssueCode } from '@xihan-ui/designer-kit/properties'
import type { CommonIssueCode, SchemaIssue } from '@xihan-ui/designer-kit/schema'

/** 读取未知输入时的结构问题码：通用问题码之外只有版本不受支持。 */
export type FlowSchemaIssueCode = CommonIssueCode | 'document.unsupported-version'

/** 按节点类型登记表校验文档时的问题码；required 与取值问题码来自节点属性检查。 */
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
    | 'required'
    | PropertyValueIssueCode

/** 全部问题码。 */
export type FlowIssueCode = FlowSchemaIssueCode | FlowValidationIssueCode

/** 连线的一端。 */
export type FlowEdgeEnd = 'source' | 'target'

/**
 * 一条问题：问题码、从文档根算起的路径、所在对象（节点为 { kind: 'node', id }，连线为 { kind: 'edge', id }）、
 * 严重程度与参数，不带文案。
 */
export type FlowIssue<C extends FlowIssueCode = FlowIssueCode> = SchemaIssue<C>
