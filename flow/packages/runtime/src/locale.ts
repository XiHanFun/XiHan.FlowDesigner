/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程产品的中文文案，查看器与设计器共用，含设计器零件的中文：与 UI 的语言包一起交给 mergeXhConfig，再经 setXhConfig 或 <xh-config> 生效。

import type { FlowIssue } from '@xihan-flow/core'
import type { XhConfig } from '@xihan-ui/web-components'
import type { FlowIssueNames } from './translations'
import { designerShellZhCN } from '@xihan-ui/designer-shell/locale'

const PROPERTY_LABELS: Readonly<Record<string, string>> = {
  'label': '名称',
  'style.dashed': '虚线',
}

function issueText(issue: FlowIssue, names: FlowIssueNames): string {
  const params = issue.params ?? {}
  const text = (key: string): string => String(params[key] ?? '')
  const type = (key: string): string => names.nodeType(text(key))
  switch (issue.code) {
    case 'node.duplicate-id':
      return `节点 id「${text('id')}」重复`
    case 'node.unknown-type':
      return `节点类型「${text('type')}」没有登记`
    case 'edge.duplicate-id':
      return `连线 id「${text('id')}」重复`
    case 'edge.dangling':
      return `连线指向不存在的节点「${text('node')}」`
    case 'edge.unknown-port':
      return `端口「${text('port')}」不存在`
    case 'edge.invalid-direction':
      return '端口方向不允许这样连接'
    case 'edge.self-loop':
      return '节点不能连向自己'
    case 'edge.target-not-allowed':
      return `「${type('sourceType')}」不能连向「${type('targetType')}」`
    case 'edge.source-not-allowed':
      return `「${type('targetType')}」不接受来自「${type('sourceType')}」的连线`
    case 'node.max-incoming':
      return `入线最多 ${text('max')} 条，现有 ${text('count')} 条`
    case 'node.max-outgoing':
      return `出线最多 ${text('max')} 条，现有 ${text('count')} 条`
    case 'port.max-connections':
      return `端口「${text('port')}」最多连 ${text('max')} 条，现有 ${text('count')} 条`
    case 'type.min-count':
      return `至少需要 ${text('min')} 个「${type('type')}」，现有 ${text('count')} 个`
    case 'type.max-count':
      return `「${type('type')}」最多 ${text('max')} 个，现有 ${text('count')} 个`
    case 'node.isolated':
      return '没有任何连线'
    case 'node.missing-incoming':
      return '缺少入线'
    case 'node.missing-outgoing':
      return '缺少出线'
    case 'node.unreachable':
      return '从开始节点走不到这里'
    case 'required':
      return '必填'
    case 'invalid-type':
      return '取值类型不对'
    case 'out-of-range':
      return '超出允许的范围'
    case 'not-integer':
      return '必须是整数'
    case 'invalid-option':
      return '不在可选项里'
    case 'invalid-color':
      return '不是有效的颜色'
    case 'invalid-value':
      return '取值不合法'
    case 'unknown-key':
      return '含有不认识的字段'
    case 'unknown-control':
      return '没有这种编辑方式'
    default:
      return issue.code
  }
}

/** 流程查看器与设计器的中文文案。 */
export const flowZhCN: XhConfig = {
  translations: {
    ...designerShellZhCN.translations,
    'xh-flow-viewer': { label: '流程图' },
    'xh-flow-designer': {
      label: '流程设计器',
      toolbar: '设计器工具',
      openFile: '打开文件',
      undo: '撤销',
      redo: '重做',
      delete: '删除',
      duplicate: '创建副本',
      copy: '复制',
      cut: '剪切',
      paste: '粘贴',
      selectAll: '全选',
      alignLeft: '左对齐',
      alignCenter: '水平居中',
      alignRight: '右对齐',
      alignTop: '顶端对齐',
      alignMiddle: '垂直居中',
      alignBottom: '底端对齐',
      distributeHorizontal: '水平等距',
      distributeVertical: '垂直等距',
      autoLayout: '自动布局',
      clearVertices: '清除拐点',
      zoomIn: '放大',
      zoomOut: '缩小',
      zoomToFit: '适配',
      zoomToActual: '100%',
      palette: '节点',
      paletteUncategorized: '其他',
      propertiesEmpty: '选中节点或连线，在这里编辑它们的属性',
      propertiesMultiple: count => `已选中 ${count} 个对象`,
      edge: '连线',
      propertyLabel: key => Object.hasOwn(PROPERTY_LABELS, key) ? PROPERTY_LABELS[key]! : key,
      issue: issueText,
      propertyIssue: (property, message) => `${property}：${message}`,
      issuesEmpty: '没有问题',
      flow: '流程',
    },
  },
}
