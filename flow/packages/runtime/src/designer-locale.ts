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
  settingsMinimap: 'Minimap',
  settingsMinimapHint: 'Show the minimap in the bottom-right corner of the canvas.',
  settingsSnap: 'Snap to nodes',
  settingsSnapHint: 'While dragging, snap to other nodes and show alignment guides.',
  statusZoom: 'Zoom',
  statusSelected: count => `${count} selected`,
  statusDocument: (nodes, edges) => `${nodes} ${nodes === 1 ? 'node' : 'nodes'}, ${edges} ${edges === 1 ? 'connection' : 'connections'}`,
  statusGeometry: (x, y, width, height) => `X ${x}, Y ${y} · ${width} × ${height}`,
  flow: 'Flow',
  startVariableColumns: { name: 'Name', required: 'Required', defaultValue: 'Default value', description: 'Description' },
  startVariableAdd: 'Add variable',
  startVariableCell: (row, column) => `${column} of variable ${row}`,
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
    'unknown-control': () => 'Unknown editor kind',
  },
}

/** 设计器不配语言包时的缺省文案。 */
export const DEFAULT_FLOW_DESIGNER_TRANSLATIONS: FlowDesignerTranslations = /* @__PURE__ */ flowDesignerTranslations(FLOW_DESIGNER_EN_US)
