/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowCoreExtension, FlowModel } from '@xihan-flow/core'
import type { FlowNodeRenderer } from './flow-viewer'
import { createFlowModel } from '@xihan-flow/core'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'

/** 流程运行时层的扩展：在 core 层之上加节点内容的渲染，查看器与设计器都读它。 */
export interface FlowRuntimeExtension extends FlowCoreExtension {
  /** 节点内容的渲染，键是节点类型；没给渲染的类型画标签。 */
  readonly nodeRenderers?: Readonly<Record<string, FlowNodeRenderer>>
}

/** 运行时用的流程模型：core 的模型加上各节点类型的渲染。 */
export interface FlowRuntimeModel extends FlowModel {
  readonly renderers: ReadonlyMap<string, FlowNodeRenderer>
}

const MODELS = new WeakMap<readonly FlowRuntimeExtension[], FlowRuntimeModel>()
const NO_EXTENSIONS: readonly FlowRuntimeExtension[] = []

/** 合出运行时用的流程模型；同一节点类型在两个扩展里都给了渲染时抛 DesignerExtensionError。同一个数组只合一次。 */
export function createFlowRuntimeModel(extensions: readonly FlowRuntimeExtension[] = NO_EXTENSIONS): FlowRuntimeModel {
  const cached = MODELS.get(extensions)
  if (cached)
    return cached
  const model = createFlowModel(extensions)
  const renderers = new Map<string, FlowNodeRenderer>()
  const owners = new Map<string, string>()
  for (const extension of model.extensions as readonly FlowRuntimeExtension[]) {
    for (const [type, renderer] of Object.entries(extension.nodeRenderers ?? {})) {
      const previous = owners.get(type)
      if (previous !== undefined)
        throw new DesignerExtensionError('node-renderer', type, [previous, extension.id])
      owners.set(type, extension.id)
      renderers.set(type, renderer)
    }
  }
  const runtime: FlowRuntimeModel = { ...model, renderers }
  MODELS.set(extensions, runtime)
  return runtime
}
