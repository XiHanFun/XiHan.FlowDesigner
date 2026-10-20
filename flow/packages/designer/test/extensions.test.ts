/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @vitest-environment jsdom

import type { FlowDesignerContext, FlowDesignerExtension, XhFlowDesigner } from '../src'
import { createXihanWorkflow, fromWorkflowDefinition, xihanWorkflowZhCN } from '@xihan-flow/core/presets/xihan-workflow'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlowDesigner, FLOW_DESIGNER_TAG } from '../src'
import { definitions, mount, nodes, part, sample, unmountAll } from './helpers'

defineFlowDesigner()

afterEach(unmountAll)

function conflict(run: () => void): { space: string, key: string, extensions: readonly string[] } {
  try {
    run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(DesignerExtensionError)
    const { code, space, key, extensions } = error as DesignerExtensionError
    expect(code).toBe('designer.extension-conflict')
    return { space, key, extensions }
  }
  throw new Error('expected a conflict')
}

function toolbarItems(designer: Element): string[] {
  return Array.from(designer.querySelectorAll<HTMLButtonElement>('[data-part="command-bar"] button[data-xh-part="item"]'), item => item.value)
}

// 菜单打开后内容会搬进浮层落点，挂载后先记下内容节点
function menuContent(designer: Element): HTMLElement {
  return designer.querySelector<HTMLElement>('xh-context-menu [data-xh-part="content"]')!
}

function menuItems(content: HTMLElement): string[] {
  return Array.from(content.querySelectorAll<HTMLElement>('[data-xh-part="item"]'), item => item.getAttribute('value')!)
}

function key(designer: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  part(designer, 'viewport')[0]!.dispatchEvent(event)
  return event
}

async function settle(designer: XhFlowDesigner): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await designer.updateComplete
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-frame')!.updateComplete
    await Promise.resolve()
  }
}

describe('扩展', () => {
  it('冲突在给 extensions 赋值时抛错，属性与界面保持原样', async () => {
    const designer = await mount()
    const before = designer.extensions
    const run = vi.fn()
    const create = vi.fn()
    expect(conflict(() => (designer.extensions = [nodes, { id: 'acme', commands: [{ id: 'undo', label: 'U', run }] }])))
      .toEqual({ space: 'command', key: 'undo', extensions: ['@xihan-flow/designer', 'acme'] })
    expect(conflict(() => (designer.extensions = [nodes, { id: 'acme', commands: [{ id: 'acme.run', label: 'Run', shortcut: ['Mod', 'Z'], run }] }])))
      .toEqual({ space: 'shortcut', key: 'Control+z', extensions: ['@xihan-flow/designer', 'acme'] })
    expect(conflict(() => (designer.extensions = [nodes, { id: 'acme', nodeTypes: [definitions[0]!] }])))
      .toEqual({ space: 'node-type', key: 'start', extensions: ['test', 'acme'] })
    expect(conflict(() => (designer.extensions = [nodes, { id: 'acme', panels: [{ region: { name: 'toolbar', position: 'top' }, create }] }])))
      .toEqual({ space: 'panel', key: 'toolbar', extensions: ['builtin', 'acme'] })
    const source = { id: 'mine', groups: () => [], insert: () => {} }
    expect(conflict(() => (designer.extensions = [nodes, { id: 'acme', paletteSources: [source] }, { id: 'beta', paletteSources: [source] }])))
      .toEqual({ space: 'palette-source', key: 'mine', extensions: ['acme', 'beta'] })
    expect(conflict(() => (designer.extensions = [nodes, { id: '@xihan-flow/core' }])).space).toBe('extension')
    expect(create).not.toHaveBeenCalled()
    expect(designer.extensions).toBe(before)
    await settle(designer)
    expect(toolbarItems(designer)).not.toContain('acme.run')
  })

  it('setup 在连上文档时调用、断开时清理；同一个对象保持引用不重装，换了引用当作卸下再装上', async () => {
    const cleanup = vi.fn()
    const setup = vi.fn((_context: FlowDesignerContext) => cleanup)
    const tracked: FlowDesignerExtension = { id: 'acme', setup }
    const designer = window.document.createElement(FLOW_DESIGNER_TAG)
    designer.extensions = [nodes, tracked]
    designer.schema = sample()
    expect(setup).not.toHaveBeenCalled()
    window.document.body.append(designer)
    await designer.updateComplete
    expect(setup).toHaveBeenCalledTimes(1)
    expect(setup.mock.calls[0]![0].designer).toBe(designer)
    expect([setup.mock.calls[0]![0].translations.autoLayout, setup.mock.calls[0]![0].commandTranslations.undo]).toEqual(['Auto layout', 'Undo'])

    designer.extensions = [tracked, nodes]
    expect([setup.mock.calls.length, cleanup.mock.calls.length]).toEqual([1, 0])
    designer.extensions = [nodes, { ...tracked }]
    expect([setup.mock.calls.length, cleanup.mock.calls.length]).toEqual([2, 1])
    designer.extensions = [nodes]
    expect([setup.mock.calls.length, cleanup.mock.calls.length]).toEqual([2, 2])

    designer.extensions = [nodes, tracked]
    designer.remove()
    expect([setup.mock.calls.length, cleanup.mock.calls.length]).toEqual([3, 3])
    window.document.body.append(designer)
    expect(setup).toHaveBeenCalledTimes(4)
    designer.remove()
  })

  it('扩展命令按 placement 追加到工具栏与右键菜单，快捷键在画布上生效；commandLayout 改写排列', async () => {
    const run = vi.fn()
    const hello: FlowDesignerExtension = {
      id: 'acme',
      commands: [{
        id: 'acme.hello',
        label: context => `Hello ${context.designer.schema.nodes.length}`,
        placement: ['toolbar', 'menu:node'],
        shortcut: ['Mod', 'Shift', 'H'],
        enabled: context => !context.designer.readonly,
        run,
      }],
    }
    const designer = await mount(element => (element.extensions = [nodes, hello]))
    const content = menuContent(designer)
    await settle(designer)
    expect(toolbarItems(designer).slice(-4)).toEqual(['export-png', 'export-svg', 'panels', 'acme.hello'])
    expect(designer.querySelector('[data-part="command-bar"] button[value="acme.hello"]')!.textContent).toBe('Hello 3')

    designer.querySelector('[data-part="node"][data-node-id="t"]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(menuItems(content)).toEqual(['cut', 'copy', 'duplicate', 'delete', 'acme.hello'])
    const shortcut = content.querySelector('[data-xh-part="item"][value="acme.hello"] [data-xh-part="item-shortcut"]')!
    expect(shortcut.textContent).toBe('Ctrl+Shift+H')
    designer.querySelector('xh-context-menu')!.dispatchEvent(new CustomEvent('item-select', { detail: { value: 'acme.hello' } }))
    expect(run).toHaveBeenCalledTimes(1)

    expect(key(designer, { key: 'H', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true)
    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[1]![0].designer).toBe(designer)
    designer.readonly = true
    expect(key(designer, { key: 'H', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false)
    expect(run).toHaveBeenCalledTimes(2)

    designer.commandLayout = { 'toolbar': [['acme.hello', 'undo']], 'menu:blank': [['zoom-to-fit']] }
    await settle(designer)
    expect(toolbarItems(designer)).toEqual(['acme.hello', 'undo'])
    part(designer, 'viewport')[0]!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(menuItems(content)).toEqual(['zoom-to-fit'])
  })

  it('扩展面板放进外框的命名区，状态变化时刷新；去掉扩展时撤掉', async () => {
    const update = vi.fn()
    const destroy = vi.fn()
    const panel: FlowDesignerExtension = {
      id: 'acme',
      panels: [{
        region: { name: 'acme-sim', position: 'end' },
        create: () => ({ element: window.document.createElement('section'), update, destroy }),
      }],
    }
    const designer = await mount(element => (element.extensions = [nodes, panel]))
    await settle(designer)
    const frame = designer.querySelector<HTMLElement & { regions: readonly { name: string, label?: string }[] }>('xh-designer-frame')!
    const element = frame.querySelector('section[slot="acme-sim"]')!
    expect(element).not.toBeNull()
    expect(frame.regions.map(region => region.name)).toEqual(['menubar', 'toolbar', 'palette', 'canvas', 'properties', 'issues', 'status', 'minimap', 'outline', 'history', 'acme-sim'])
    expect(frame.regions.find(region => region.name === 'toolbar')!.label).toBe('Designer actions')
    designer.select({ nodes: ['t'] })
    await settle(designer)
    expect(update.mock.calls.at(-1)![0].designer.getSelection().nodes).toEqual(['t'])

    designer.extensions = [nodes]
    await settle(designer)
    expect([element.isConnected, destroy.mock.calls.length]).toEqual([false, 1])
    expect(frame.regions.map(region => region.name)).toEqual(['menubar', 'toolbar', 'palette', 'canvas', 'properties', 'issues', 'status', 'minimap', 'outline', 'history'])
  })

  it('节点渲染与规则随扩展；去掉扩展后它的节点类型在文档里照样保留、校验报 node.unknown-type，再装上恢复', async () => {
    const tasks: FlowDesignerExtension = {
      id: '@acme/tasks',
      nodeTypes: [{ type: 'task', label: '任务', size: { width: 100, height: 40 }, ports: 'both' }],
      nodeRenderers: { task: (container, context) => (container.textContent = `#${context.label}`) },
      rules: [document => document.nodes.length > 2 ? [{ code: 'tasks.too-many', path: [], severity: 'warning' }] : []],
      issueText: issue => (issue.code === 'tasks.too-many' ? '任务太多' : undefined),
    }
    const base: FlowDesignerExtension = { id: 'test', nodeTypes: definitions.filter(definition => definition.type !== 'task') }
    const designer = await mount(element => (element.extensions = [base, tasks]))
    const text = (id: string): string => designer.querySelector(`[data-part="node"][data-node-id="${id}"]`)!.textContent!
    expect(text('t')).toBe('#任务')
    expect(designer.validate().map(issue => issue.code)).toContain('tasks.too-many')
    await settle(designer)
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-issues')!.updateComplete
    expect(Array.from(designer.querySelectorAll('xh-designer-issues [data-part="issue-message"]'), item => item.textContent)).toContain('任务太多')

    designer.extensions = [base]
    await settle(designer)
    expect(designer.schema.nodes.map(node => node.id)).toEqual(['s', 't', 'e'])
    expect(text('t')).toBe('t')
    expect(designer.querySelector<HTMLElement>('[data-part="node"][data-node-id="t"]')!.dataset.issue).toBe('error')
    expect(designer.validate().map(issue => issue.code)).toEqual(expect.arrayContaining(['node.unknown-type']))
    expect(designer.validate().map(issue => issue.code)).not.toContain('tasks.too-many')

    designer.extensions = [base, tasks]
    await settle(designer)
    expect(text('t')).toBe('#任务')
    expect(designer.validate().map(issue => issue.code)).not.toContain('node.unknown-type')
  })

  it('装上 XiHan 工作流预设：勾选、取消默认分支时连线跟着画成虚线、实线，撤销回到原样', async () => {
    const designer = window.document.createElement(FLOW_DESIGNER_TAG)
    designer.extensions = [createXihanWorkflow({ texts: xihanWorkflowZhCN })]
    designer.schema = fromWorkflowDefinition({
      code: 'leave',
      name: '请假',
      nodes: [
        { id: 'start', activityType: 'Start' },
        { id: 'check', activityType: 'Decision' },
        { id: 'long', activityType: 'End' },
        { id: 'short', activityType: 'End' },
      ],
      transitions: [
        { id: 'a', sourceNodeId: 'start', targetNodeId: 'check' },
        { id: 'b', sourceNodeId: 'check', targetNodeId: 'long', condition: 'days > 3' },
        { id: 'c', sourceNodeId: 'check', targetNodeId: 'short', priority: 1 },
      ],
    })
    window.document.body.append(designer)
    await settle(designer)
    const dashed = (): boolean => designer.querySelector('[data-part="edge"][data-edge-id="c"]')!.hasAttribute('data-dashed')
    expect(dashed()).toBe(false)

    designer.execute([{ type: 'updateEdge', id: 'c', patch: { data: { priority: 1, isDefault: true } } }])
    await settle(designer)
    expect(dashed()).toBe(true)
    expect(designer.schema.edges.find(edge => edge.id === 'c')!.style).toBeUndefined()

    designer.execute([{ type: 'updateEdge', id: 'c', patch: { data: { priority: 1, isDefault: false } } }])
    await settle(designer)
    expect(dashed()).toBe(false)
    designer.undo()
    await settle(designer)
    expect(dashed()).toBe(true)
    designer.remove()
  })

  it('装上 XiHan 工作流预设：引擎定义换来的文档没有问题，物料按预设分类，没选中时编辑流程定义', async () => {
    const preset = createXihanWorkflow({ texts: xihanWorkflowZhCN })
    const designer = window.document.createElement(FLOW_DESIGNER_TAG)
    designer.extensions = [preset]
    designer.paletteGroupLabels = xihanWorkflowZhCN.categories
    designer.schema = fromWorkflowDefinition({
      code: 'leave',
      name: '请假',
      nodes: [
        { id: 'start', name: '提交', activityType: 'Start' },
        { id: 'task', name: '审批', activityType: 'UserTask', properties: { AssigneeRules: [{ type: 'Starter', values: [] }] } },
        { id: 'end', name: '结束', activityType: 'End' },
      ],
      transitions: [{ id: 'a', sourceNodeId: 'start', targetNodeId: 'task' }, { id: 'b', sourceNodeId: 'task', targetNodeId: 'end' }],
    })
    window.document.body.append(designer)
    await settle(designer)
    expect(designer.validate()).toEqual([])
    expect(designer.querySelector('[data-part="node"][data-node-id="task"]')!.textContent).toBe('审批')
    const panel = designer.querySelector('xh-designer-properties')!
    expect(Array.from(panel.querySelectorAll<HTMLElement>('[data-part="property"]'), item => item.dataset.path))
      .toEqual(['data.code', 'data.name', 'data.category', 'data.description', 'data.variables', 'data.enableCompensation'])

    designer.execute([{ type: 'updateNode', id: 'task', patch: { data: null } }])
    await settle(designer)
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-issues')!.updateComplete
    expect(Array.from(designer.querySelectorAll('xh-designer-issues [data-part="issue-message"]'), item => item.textContent))
      .toContain('配置受理人规则、受理人或受理人表达式')
    designer.remove()
  })
})
