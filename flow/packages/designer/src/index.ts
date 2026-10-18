/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-flow/designer 的公共接口。元素不在 import 时注册，调用 defineFlowDesigner() 才注册。

export { decodeFlowClipboard, encodeFlowClipboard } from './clipboard'
export type { FlowAutoLayoutOptions, FlowClipboard, FlowSelection } from './editor'
export { createFlowDesignerModel, FLOW_DESIGNER_EXTENSION, FLOW_DESIGNER_HELP_URL, FLOW_TOOLBAR_LAYOUT, flowMenuLayout, flowToolbarLayout } from './extensions'
export type {
  FlowDesignerCommand,
  FlowDesignerContext,
  FlowDesignerExporter,
  FlowDesignerExtension,
  FlowDesignerImporter,
  FlowDesignerModel,
  FlowExportContext,
  FlowImportDocument,
  FlowImportFragment,
  FlowImportResult,
  FlowMenuSubject,
} from './extensions'
export { defineFlowDesigner, FLOW_DESIGNER_TAG, XhFlowDesigner } from './flow-designer'
export type { FlowDesignerEventMap, FlowDesignerPanel, FlowSchemaChangeKind } from './flow-designer'
export type { FlowPropertyEditor, FlowPropertyEditorContext, FlowPropertyEditorInstance, FlowPropertyTarget } from './panels/properties'
