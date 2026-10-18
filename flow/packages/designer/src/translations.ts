/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的英文缺省文案；中文在 @xihan-flow/runtime/locale 的 flowZhCN 里。

import type { FlowIssue } from '@xihan-flow/core'
import type { FlowDesignerTranslations, FlowIssueNames } from '@xihan-flow/runtime'

const PROPERTY_LABELS: Readonly<Record<string, string>> = {
  'label': 'Label',
  'style.dashed': 'Dashed',
}

function issueText(issue: FlowIssue, names: FlowIssueNames): string {
  const params = issue.params ?? {}
  const text = (key: string): string => String(params[key] ?? '')
  const type = (key: string): string => names.nodeType(text(key))
  switch (issue.code) {
    case 'node.duplicate-id':
      return `Node id "${text('id')}" is used more than once`
    case 'node.unknown-type':
      return `Node type "${text('type')}" is not registered`
    case 'edge.duplicate-id':
      return `Connection id "${text('id')}" is used more than once`
    case 'edge.dangling':
      return `Connection points to missing node "${text('node')}"`
    case 'edge.unknown-port':
      return `Port "${text('port')}" does not exist`
    case 'edge.invalid-direction':
      return 'The port direction does not allow this connection'
    case 'edge.self-loop':
      return 'A node cannot connect to itself'
    case 'edge.target-not-allowed':
      return `${type('sourceType')} cannot connect to ${type('targetType')}`
    case 'edge.source-not-allowed':
      return `${type('targetType')} does not accept connections from ${type('sourceType')}`
    case 'node.max-incoming':
      return `At most ${text('max')} incoming connections, found ${text('count')}`
    case 'node.max-outgoing':
      return `At most ${text('max')} outgoing connections, found ${text('count')}`
    case 'port.max-connections':
      return `Port "${text('port')}" takes at most ${text('max')} connections, found ${text('count')}`
    case 'type.min-count':
      return `At least ${text('min')} ${type('type')} required, found ${text('count')}`
    case 'type.max-count':
      return `At most ${text('max')} ${type('type')} allowed, found ${text('count')}`
    case 'node.isolated':
      return 'Not connected'
    case 'node.missing-incoming':
      return 'No incoming connection'
    case 'node.missing-outgoing':
      return 'No outgoing connection'
    case 'node.unreachable':
      return 'Cannot be reached from a start node'
    case 'required':
      return 'Required'
    case 'invalid-type':
      return 'Wrong value type'
    case 'out-of-range':
      return 'Out of range'
    case 'not-integer':
      return 'Must be an integer'
    case 'invalid-option':
      return 'Not one of the options'
    case 'invalid-color':
      return 'Not a valid color'
    case 'invalid-value':
      return 'Invalid value'
    case 'unknown-key':
      return 'Contains an unknown field'
    case 'unknown-control':
      return 'Unknown editor kind'
    default:
      return issue.code
  }
}

/** 设计器的英文缺省文案。 */
export const DEFAULT_TRANSLATIONS: FlowDesignerTranslations = {
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
  palette: 'Nodes',
  paletteUncategorized: 'Other',
  propertiesEmpty: 'Select nodes or connections to edit their properties',
  propertiesMultiple: count => `${count} items selected`,
  edge: 'Connection',
  propertyLabel: key => Object.hasOwn(PROPERTY_LABELS, key) ? PROPERTY_LABELS[key]! : key,
  issue: issueText,
  propertyIssue: (property, message) => `${property}: ${message}`,
  issuesEmpty: 'No problems',
  flow: 'Flow',
}
