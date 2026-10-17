/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器：编辑费用审批。状态行显示最近一次修改，按「保存」或在画布上按 Ctrl / ⌘ + S 记为已保存；可以切换只读。

import type { FlowDesignerEventMap, FlowSchemaChangeKind } from '@xihan-flow/designer'
import { xihanWorkflowZhCN } from '@xihan-flow/core/presets/xihan-workflow'
// #region register
import { defineFlowDesigner } from '@xihan-flow/designer'
import { extensions, schema } from '../schemas/approval'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-flow/runtime/style.css'
import '@xihan-flow/designer/style.css'

defineFlowDesigner()
// #endregion register

const KIND_TEXT: Readonly<Record<FlowSchemaChangeKind, string>> = { execute: '修改', undo: '撤销', redo: '重做', load: '装载' }

function button(text: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = text
  element.addEventListener('click', onClick)
  return element
}

export function mount(host: HTMLElement): () => void {
  // #region setup
  const designer = document.createElement('xh-flow-designer')
  designer.extensions = extensions
  designer.paletteGroupOrder = ['human', 'control']
  designer.paletteGroupLabels = xihanWorkflowZhCN.categories
  designer.propertyGroupOrder = ['basic', 'participants', 'form', 'execution']
  designer.propertyGroupLabels = xihanWorkflowZhCN.groups
  designer.schema = schema
  // #endregion setup

  const status = document.createElement('p')
  status.textContent = '还没有修改'

  // #region change
  designer.addEventListener('schema-change', (event) => {
    const { kind, operations } = (event as FlowDesignerEventMap['schema-change']).detail
    status.textContent = `${KIND_TEXT[kind]}：${operations.map(operation => operation.type).join('、')}`
  })
  // #endregion change

  // #region save
  const saveNow = (): void => {
    // 宿主在这里把 designer.schema 交给后端，保存成功后记为已保存
    designer.markSaved()
    status.textContent = '已保存'
  }
  const save = button('保存', saveNow)
  save.disabled = true
  designer.addEventListener('save', saveNow)
  designer.addEventListener('dirty-change', (event) => {
    save.disabled = !(event as FlowDesignerEventMap['dirty-change']).detail.dirty
  })
  // #endregion save

  // #region readonly
  const readonly = button('只读', () => {
    designer.readonly = !designer.readonly
    readonly.setAttribute('aria-pressed', String(designer.readonly))
  })
  readonly.setAttribute('aria-pressed', 'false')
  // #endregion readonly

  host.append(save, readonly, status, designer)
  return () => host.replaceChildren()
}
