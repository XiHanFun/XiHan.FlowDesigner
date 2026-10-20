/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器文案的写法：问题说明按问题码、内建属性名按路径逐条写成表，各语言包都写全，类型钉住每一个键；
// 再换成设计器读的 FlowDesignerTranslations。设计器的英文缺省也在这里。

import type { FlowIssue, FlowIssueCode } from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowIssueNames } from './translations'

/** 一条问题说明：text 取参数的文字，type 取参数里那个节点类型的显示名。 */
export type FlowIssueMessage = (text: (key: string) => string, type: (key: string) => string) => string

/** 设计器内建的属性路径，formatJsonPath 的写法。 */
export type FlowBuiltinPropertyKey = 'label' | 'style.dashed'

/** 一种语言的设计器文案：问题说明与内建属性名写成表，其余与 FlowDesignerTranslations 相同。 */
export interface FlowDesignerLocale extends Omit<FlowDesignerTranslations, 'issue' | 'propertyLabel'> {
  /** 每个问题码的说明。 */
  readonly issues: Readonly<Record<FlowIssueCode, FlowIssueMessage>>
  /** 内建属性没有给 label 时的属性名。 */
  readonly propertyLabels: Readonly<Record<FlowBuiltinPropertyKey, string>>
}

/** 把一种语言的设计器文案换成设计器读的形状：问题按码查表，表里没有的（扩展的问题码）显示问题码。 */
export function flowDesignerTranslations(locale: FlowDesignerLocale): FlowDesignerTranslations {
  const { issues, propertyLabels, ...texts } = locale
  return {
    ...texts,
    propertyLabel: key => Object.hasOwn(propertyLabels, key) ? propertyLabels[key as FlowBuiltinPropertyKey] : key,
    issue: (issue: FlowIssue, names: FlowIssueNames) => {
      if (!Object.hasOwn(issues, issue.code))
        return issue.code
      const params = issue.params ?? {}
      const text = (key: string): string => String(params[key] ?? '')
      return issues[issue.code as FlowIssueCode](text, key => names.nodeType(text(key)))
    },
  }
}

/** 设计器的英文文案，也是不配语言包时的缺省。 */
export const FLOW_DESIGNER_EN_US: FlowDesignerLocale = {
  label: 'Flow designer',
  openFile: 'Open file',
  autoLayout: 'Auto layout',
  clearVertices: 'Reset route',
  exportPng: 'Export PNG',
  exportSvg: 'Export SVG',
  exportImage: 'Flow image',
  palette: 'Nodes',
  minimap: 'Minimap',
  paletteUncategorized: 'Other',
  propertiesEmpty: 'Select nodes or connections to edit their properties',
  propertiesMultiple: count => `${count} items selected`,
  edge: 'Connection',
  propertyIssue: (property, message) => `${property}: ${message}`,
  issuesEmpty: 'No problems',
  paletteHelp: 'Drag a node onto the canvas, or click it to place it in the middle of the view.',
  propertiesHelp: 'Edit the selected nodes or connections. With nothing selected, edit the flow definition.',
  issuesHelp: 'Problems found when checking the flow definition. Click one to select the node or connection it is on.',
  settingsCanvas: 'Canvas',
  settingsLayoutDirection: 'Auto layout direction',
  settingsLayoutDirectionHint: 'Auto layout arranges the nodes in layers along this direction.',
  settingsLayoutDirections: { TB: 'Top to bottom', BT: 'Bottom to top', LR: 'Left to right', RL: 'Right to left' },
  settingsNodeGap: 'Node spacing',
  settingsNodeGapHint: 'Space between neighboring nodes in the same layer.',
  settingsLayerGap: 'Layer spacing',
  settingsLayerGapHint: 'Space between neighboring layers.',
  settingsSnap: 'Snap to nodes',
  settingsSnapHint: 'While dragging, snap to other nodes and show alignment guides.',
  statusZoom: 'Zoom',
  statusSelected: count => `${count} selected`,
  statusDocument: (nodes, edges) => `${nodes} ${nodes === 1 ? 'node' : 'nodes'}, ${edges} ${edges === 1 ? 'connection' : 'connections'}`,
  statusGeometry: (x, y, width, height) => `X ${x}, Y ${y} · ${width} × ${height}`,
  selectionToolbar: 'Selection',
  alignMenu: 'Align and distribute',
  flow: 'Flow',
  startVariableColumns: { name: 'Name', required: 'Required', defaultValue: 'Default value', description: 'Description' },
  startVariableAdd: 'Add variable',
  startVariableCell: (row, column) => `${column} of variable ${row}`,
  tourSteps: {
    connect: { title: 'Connect', description: 'Drag from a port on the edge of a node to another node. With a connection selected, drag its ends to reconnect it or drag its bends to reroute it.' },
    autoLayout: { title: 'Auto layout', description: 'Arranges the nodes in layers along the connections. Change the direction and spacing on the Canvas page of the settings.' },
  },
  helpNotes: [
    'Drag nodes from the Nodes panel on the left onto the canvas, or click one to add it. Edit them in the Properties panel on the right.',
    'Drag from a port on the edge of a node to another node to connect them. With a connection selected, drag its ends to reconnect it, drag a bend to reroute it, or double-click a bend to remove it.',
    'Drag empty space to pan the canvas, Shift-drag to select an area, and hold Ctrl / ⌘ while scrolling to zoom.',
    'Ctrl / ⌘ + S asks the host system to save the flow; the designer does not save on its own.',
  ],
  shortcutNudge: 'Move the selected nodes; pan the canvas when no node is selected',
  shortcutCancel: 'Cancel the drag in progress',
  shortcutContextMenu: 'Open the context menu',
  outline: { title: 'Flow structure', help: 'The nodes of the flow, each with the connections leaving it (folded at first). Choose an item to select and reveal it on the canvas; point at one to mark it there.', search: 'Search flow structure', empty: 'No nodes yet' },
  history: {
    node: (kind, name) => `${kind} ${name}`,
    addNode: label => `Add ${label}`,
    addNodes: count => `Add ${count} nodes`,
    removeNode: label => `Delete ${label}`,
    removeNodes: count => `Delete ${count} nodes`,
    moveNode: label => `Move ${label}`,
    moveNodes: count => `Move ${count} nodes`,
    resizeNode: label => `Resize ${label}`,
    resizeNodes: count => `Resize ${count} nodes`,
    editNode: label => `Edit ${label}`,
    editNodes: count => `Edit ${count} nodes`,
    copyNode: label => `Copy ${label}`,
    copyNodes: count => `Copy ${count} nodes`,
    addEdge: 'Add connection',
    addEdges: count => `Add ${count} connections`,
    removeEdge: 'Delete connection',
    removeEdges: count => `Delete ${count} connections`,
    reconnectEdge: 'Reconnect connection',
    editRoute: 'Change connection route',
    editEdge: 'Edit connection',
    editEdges: count => `Edit ${count} connections`,
    editProperty: name => `Change “${name}”`,
    editDocument: 'Edit flow properties',
    editJson: 'Edit JSON',
  },
  propertyLabels: { 'label': 'Label', 'style.dashed': 'Dashed' },
  issues: {
    'document.unsupported-version': text => `Unsupported flow definition version ${text('version')}`,
    'node.duplicate-id': text => `Node id "${text('id')}" is used more than once`,
    'node.unknown-type': text => `Node type "${text('type')}" is not registered`,
    'edge.duplicate-id': text => `Connection id "${text('id')}" is used more than once`,
    'edge.dangling': text => `Connection points to missing node "${text('node')}"`,
    'edge.unknown-port': text => `Port "${text('port')}" does not exist`,
    'edge.invalid-direction': () => 'The port direction does not allow this connection',
    'edge.self-loop': () => 'A node cannot connect to itself',
    'edge.target-not-allowed': (_, type) => `${type('sourceType')} cannot connect to ${type('targetType')}`,
    'edge.source-not-allowed': (_, type) => `${type('targetType')} does not accept connections from ${type('sourceType')}`,
    'node.max-incoming': text => `At most ${text('max')} incoming connections, found ${text('count')}`,
    'node.max-outgoing': text => `At most ${text('max')} outgoing connections, found ${text('count')}`,
    'port.max-connections': text => `Port "${text('port')}" takes at most ${text('max')} connections, found ${text('count')}`,
    'type.min-count': (text, type) => `At least ${text('min')} ${type('type')} required, found ${text('count')}`,
    'type.max-count': (text, type) => `At most ${text('max')} ${type('type')} allowed, found ${text('count')}`,
    'node.isolated': () => 'Not connected',
    'node.missing-incoming': () => 'No incoming connection',
    'node.missing-outgoing': () => 'No outgoing connection',
    'node.unreachable': () => 'Cannot be reached from a start node',
    'required': () => 'Required',
    'invalid-type': () => 'Wrong value type',
    'invalid-value': () => 'Invalid value',
    'out-of-range': () => 'Out of range',
    'not-integer': () => 'Must be an integer',
    'invalid-option': () => 'Not one of the options',
    'invalid-color': () => 'Not a valid color',
    'empty': () => 'Cannot be empty',
    'unknown-key': () => 'Contains an unknown field',
    'duplicate-key': () => 'Contains a duplicate key',
    'duplicate-id': () => 'Contains a duplicate id',
    'duplicate-value': () => 'Duplicate option value',
    'unknown-control': () => 'Unknown editor kind',
  },
}

/** 设计器不配语言包时的缺省文案。 */
export const DEFAULT_FLOW_DESIGNER_TRANSLATIONS: FlowDesignerTranslations = /* @__PURE__ */ flowDesignerTranslations(FLOW_DESIGNER_EN_US)
