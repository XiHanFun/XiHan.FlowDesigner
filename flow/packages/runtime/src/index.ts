/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-flow/runtime 的公共接口。元素不在 import 时注册，调用 defineFlowViewer() 才注册。

export { defineFlowViewer, FLOW_VIEWER_TAG, XhFlowViewer } from './flow-viewer'
export type { FlowNodeRenderContext, FlowNodeRenderer, FlowViewerEventMap } from './flow-viewer'
export { createOrthogonalRouter } from './router'
export type { OrthogonalRouterOptions } from './router'
export { buildScene } from './scene'
export type { FlowNodeStatus, FlowScene, FlowSceneEdge, FlowSceneNode, FlowSceneOptions } from './scene'
export type { FlowDesignerTranslations, FlowIssueNames, FlowViewerTranslations } from './translations'
