/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-flow/designer 的公共接口。元素不在 import 时注册，调用 defineFlowDesigner() 才注册。

export { defineFlowDesigner, FLOW_DESIGNER_TAG, XhFlowDesigner } from './flow-designer'
export type { FlowDesignerEventMap, FlowSchemaChangeKind } from './flow-designer'
