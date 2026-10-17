/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 扩展：请假流程的节点类型之外，设计器层再登记审批人的下拉编辑器、两条命令、一块统计面板，
// 以及双击节点时连同它的出线一起选中。

import type { FlowDesignerEventMap, FlowDesignerExtension, FlowPropertyEditor } from '@xihan-flow/designer'
import { defineFlowDesigner } from '@xihan-flow/designer'
import { leave, PEOPLE, schema } from '../schemas/leave'

defineFlowDesigner()

// #region editor
/** 审批人用原生下拉框选。 */
const personEditor: FlowPropertyEditor = (initial) => {
  const select = document.createElement('select')
  select.dataset.xhPart = 'control'
  select.setAttribute('aria-label', initial.descriptor.label ?? '')
  select.append(new Option('（未选）', ''), ...PEOPLE.map(name => new Option(name, name)))
  let context = initial
  select.addEventListener('change', () => {
    context.setValue(select.value === '' ? undefined : select.value)
    context.commit()
  })
  const update = (next: typeof initial): void => {
    context = next
    select.value = typeof next.value === 'string' ? next.value : ''
    select.disabled = next.readonly
  }
  update(initial)
  return { element: select, update }
}
// #endregion editor

// #region commands
const commands: FlowDesignerExtension['commands'] = [
  {
    id: '@example/leave-tools.add-approve',
    label: '加一个审批',
    placement: ['toolbar', 'menu:blank'],
    enabled: ({ designer }) => !designer.readonly,
    run: ({ designer }) => designer.addNode('approve'),
  },
  {
    id: '@example/leave-tools.grid',
    label: '吸附网格',
    placement: ['toolbar'],
    checked: ({ designer }) => designer.grid !== false,
    run: ({ designer }) => {
      designer.grid = designer.grid === false ? 16 : false
    },
  },
]
// #endregion commands

// #region panel
const panels: FlowDesignerExtension['panels'] = [
  {
    region: { name: 'leave-summary', position: 'end', label: '统计' },
    create: (context) => {
      const element = document.createElement('p')
      const update = ({ designer }: typeof context): void => {
        const approvals = designer.schema.nodes.filter(node => node.type === 'approve').length
        element.textContent = `共 ${designer.schema.nodes.length} 个节点，其中审批 ${approvals} 个`
      }
      update(context)
      return { element, update }
    },
  },
]
// #endregion panel

// #region extension
const leaveTools: FlowDesignerExtension = {
  id: '@example/leave-tools',
  editors: { byControl: { 'leave.person': personEditor } },
  commands,
  panels,
  setup: ({ designer }) => {
    const onDoubleClick = (event: Event): void => {
      const { id } = (event as FlowDesignerEventMap['node-dblclick']).detail
      designer.select({ nodes: [id], edges: designer.schema.edges.filter(edge => edge.source.node === id).map(edge => edge.id) })
    }
    designer.addEventListener('node-dblclick', onDoubleClick)
    return () => designer.removeEventListener('node-dblclick', onDoubleClick)
  },
}
// #endregion extension

export function mount(host: HTMLElement): () => void {
  // #region use
  const designer = document.createElement('xh-flow-designer')
  designer.extensions = [leave, leaveTools]
  designer.paletteGroupLabels = { leave: '请假' }
  designer.propertyGroupOrder = ['basic', 'rule']
  designer.propertyGroupLabels = { basic: '基本', rule: '规则' }
  designer.schema = schema
  // #endregion use
  host.append(designer)
  return () => host.replaceChildren()
}
