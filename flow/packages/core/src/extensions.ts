/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { JsonObject } from '@xihan-ui/core/json'
import type { DesignerExtensionCore, ExtensionKeySpaces } from '@xihan-ui/designer-kit'
import type { ControlKind } from '@xihan-ui/designer-kit/properties'
import type { FlowIssue } from './issues'
import type { FlowNodeTypeDefinition, FlowNodeTypeRegistry, FlowPropertyDescriptor } from './registry'
import type { FlowDocument } from './schema'
import { formatJsonPath } from '@xihan-ui/core/json'
import { DesignerExtensionError, extensionControls, mergeExtensions } from '@xihan-ui/designer-kit'
import { createNodeTypeRegistry } from './registry'

/** 规则拿到的上下文：合并后的节点类型。 */
export interface FlowRuleContext {
  readonly nodeTypes: FlowNodeTypeRegistry
}

/**
 * 流程 core 层的扩展：节点类型、连线属性、流程定义级属性、编辑方式与规则。
 * 运行时层与设计器层的扩展在它之上再加渲染、命令与面板，core 函数只读这里的字段。
 */
export interface FlowCoreExtension extends DesignerExtensionCore<FlowDocument, FlowRuleContext> {
  readonly nodeTypes?: readonly FlowNodeTypeDefinition[]
  /** 不随源节点类型的连线属性，path 相对连线本身，追加在内置之后；随源节点类型的写在节点类型的 outgoingEdges 上。 */
  readonly edgeProperties?: readonly FlowPropertyDescriptor[]
  /** 流程定义级属性，path 相对文档本身，没选中任何对象时属性面板显示它们。 */
  readonly documentProperties?: readonly FlowPropertyDescriptor[]
  /** 这个扩展自己的问题码的说明文字；返回 undefined 时交给设计器的文案。 */
  readonly issueText?: (issue: FlowIssue) => string | undefined
}

/** 内置扩展：连线的标签与虚线。 */
export const FLOW_CORE_EXTENSION: FlowCoreExtension = {
  id: '@xihan-flow/core',
  edgeProperties: [
    { path: ['label'], control: { kind: 'text' } },
    { path: ['style', 'dashed'], control: { kind: 'boolean' } },
  ],
}

/** 流程各层扩展共用的名字空间：节点类型、连线属性路径与流程定义级属性路径。 */
export const FLOW_EXTENSION_SPACES: ExtensionKeySpaces<FlowCoreExtension> = {
  'node-type': extension => (extension.nodeTypes ?? []).map(type => type.type),
  'edge-property': extension => (extension.edgeProperties ?? []).map(descriptor => formatJsonPath(descriptor.path)),
  'document-property': extension => (extension.documentProperties ?? []).map(descriptor => formatJsonPath(descriptor.path)),
}

/** 一组扩展合出的流程模型：节点类型、连线与流程定义级属性、编辑方式。 */
export interface FlowModel {
  /** 内置扩展在前，传入的按顺序在后。 */
  readonly extensions: readonly FlowCoreExtension[]
  readonly nodeTypes: FlowNodeTypeRegistry
  /** 不随源节点类型的连线属性。 */
  readonly edgeProperties: readonly FlowPropertyDescriptor[]
  readonly documentProperties: readonly FlowPropertyDescriptor[]
  readonly controls: Readonly<Record<string, ControlKind>>
  /** 某条连线的属性：不随源节点类型的，加上源节点类型的 outgoingEdges；源节点类型未知时只有前者。 */
  readonly edgePropertiesOf: (sourceType: string | undefined) => readonly FlowPropertyDescriptor[]
  /** 问题的说明文字：按扩展顺序取第一个给出的；都不给时为 undefined。 */
  readonly issueText: (issue: FlowIssue) => string | undefined
}

const MODELS = new WeakMap<readonly FlowCoreExtension[], FlowModel>()
const NO_EXTENSIONS: readonly FlowCoreExtension[] = []

/**
 * 合出流程模型：内置扩展 FLOW_CORE_EXTENSION 在前，extensions 按顺序在后。扩展 id、节点类型、属性路径、编辑方式等重名时
 * 抛 DesignerExtensionError；节点类型的 outgoingEdges 与不随源节点类型的连线属性同路径也抛。
 * 同一个数组只合一次：元素把同一份 extensions 交给各个 core 函数时不重复合并。
 */
export function createFlowModel(extensions: readonly FlowCoreExtension[] = NO_EXTENSIONS): FlowModel {
  const cached = MODELS.get(extensions)
  if (cached)
    return cached
  const list = mergeExtensions([FLOW_CORE_EXTENSION], extensions, FLOW_EXTENSION_SPACES)
  const edgeProperties = list.flatMap(extension => extension.edgeProperties ?? [])
  const edgeOwners = new Map(list.flatMap(extension => (extension.edgeProperties ?? []).map(descriptor => [formatJsonPath(descriptor.path), extension.id] as const)))
  const definitions = list.flatMap(extension => (extension.nodeTypes ?? []).map((definition) => {
    for (const descriptor of definition.outgoingEdges ?? []) {
      const key = formatJsonPath(descriptor.path)
      const owner = edgeOwners.get(key)
      if (owner !== undefined)
        throw new DesignerExtensionError('edge-property', key, [owner, extension.id])
    }
    return definition
  }))
  const nodeTypes = createNodeTypeRegistry(definitions)
  const model: FlowModel = {
    extensions: list,
    nodeTypes,
    edgeProperties,
    documentProperties: list.flatMap(extension => extension.documentProperties ?? []),
    controls: extensionControls(list),
    edgePropertiesOf: (sourceType) => {
      const outgoing = sourceType === undefined ? undefined : nodeTypes.get(sourceType)?.outgoingEdges
      return outgoing === undefined ? edgeProperties : [...edgeProperties, ...outgoing]
    },
    issueText: (issue) => {
      for (const extension of list) {
        const text = extension.issueText?.(issue)
        if (text !== undefined)
          return text
      }
      return undefined
    },
  }
  MODELS.set(extensions, model)
  return model
}

/**
 * 某个扩展的数据写进对象原有的 extensions 后的新值，交给 updateNode / updateEdge / updateDocument 的 patch.extensions：
 * 别的扩展的数据原样保留；data 为 undefined 时去掉这一块，去完为空时为 null（即删掉 extensions 字段）。
 */
export function patchExtensionData(current: JsonObject | undefined, id: string, data: JsonObject | undefined): JsonObject | null {
  const next: Record<string, JsonObject> = { ...(current as Record<string, JsonObject> | undefined) }
  if (data === undefined)
    delete next[id]
  else
    next[id] = data
  return Object.keys(next).length === 0 ? null : next
}
