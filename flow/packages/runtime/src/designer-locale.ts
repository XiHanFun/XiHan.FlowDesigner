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
  toolbar: 'Designer tools',
  openFile: 'Open file',
  undo: 'Undo',
  redo: 'Redo',
  delete: 'Delete',
  duplicate: 'Duplicate',
  copy: 'Copy',
  cut: 'Cut',
  paste: 'Paste',
  selectAll: 'Select all',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignTop: 'Align top',
  alignMiddle: 'Align middle',
  alignBottom: 'Align bottom',
  distributeHorizontal: 'Distribute horizontally',
  distributeVertical: 'Distribute vertically',
  autoLayout: 'Auto layout',
  clearVertices: 'Reset route',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomToFit: 'Fit',
  zoomToActual: '100%',
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
  flow: 'Flow',
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
