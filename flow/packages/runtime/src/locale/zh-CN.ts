/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程的简体中文语言包。

import type { XhConfig } from '@xihan-ui/web-components'
import { designerShellZhCN } from '@xihan-ui/designer-shell/locale'
import { flowLocale } from './types'

/** 流程的简体中文文案：查看器、设计器与 designer-shell 零件。 */
export const flowZhCN: XhConfig = /* @__PURE__ */ flowLocale(designerShellZhCN, {
  viewer: { label: '流程图' },
  designer: {
    label: '流程设计器',
    openFile: '打开文件',
    autoLayout: '自动布局',
    clearVertices: '清除拐点',
    exportPng: '导出 PNG',
    exportSvg: '导出 SVG',
    exportImage: '流程图图片',
    palette: '节点',
    paletteUncategorized: '其他',
    propertiesEmpty: '选中节点或连线，在这里编辑它们的属性',
    propertiesMultiple: count => `已选中 ${count} 个对象`,
    edge: '连线',
    propertyIssue: (property, message) => `${property}：${message}`,
    issuesEmpty: '没有问题',
    paletteHelp: '把节点拖到画布上，或点一下放到视口中央。',
    propertiesHelp: '编辑选中的节点或连线；什么都没选中时编辑流程定义。',
    issuesHelp: '校验流程定义发现的问题；点一条选中它所在的节点或连线。',
    settingsCanvas: '画布',
    settingsLayoutDirection: '自动布局方向',
    settingsLayoutDirectionHint: '自动布局按这个方向把节点分层排开。',
    settingsLayoutDirections: { TB: '自上而下', BT: '自下而上', LR: '自左而右', RL: '自右而左' },
    settingsNodeGap: '节点间距',
    settingsNodeGapHint: '同一层里相邻两个节点之间的空隙。',
    settingsLayerGap: '层间距',
    settingsLayerGapHint: '相邻两层之间的空隙。',
    settingsMinimap: '小地图',
    settingsMinimapHint: '在画布右下角显示小地图。',
    settingsSnap: '吸附对齐',
    settingsSnapHint: '拖动节点时吸附其它节点并显示对齐线。',
    flow: '流程',
    startVariableColumns: { name: '变量名', required: '必填', defaultValue: '缺省值', description: '说明' },
    startVariableAdd: '添加变量',
    startVariableCell: (row, column) => `第 ${row} 个变量的${column}`,
    propertyLabels: { 'label': '名称', 'style.dashed': '虚线' },
    issues: {
      'document.unsupported-version': text => `不支持版本为 ${text('version')} 的流程定义`,
      'node.duplicate-id': text => `节点 id「${text('id')}」重复`,
      'node.unknown-type': text => `节点类型「${text('type')}」没有登记`,
      'edge.duplicate-id': text => `连线 id「${text('id')}」重复`,
      'edge.dangling': text => `连线指向不存在的节点「${text('node')}」`,
      'edge.unknown-port': text => `端口「${text('port')}」不存在`,
      'edge.invalid-direction': () => '端口方向不允许这样连接',
      'edge.self-loop': () => '节点不能连向自己',
      'edge.target-not-allowed': (_, type) => `「${type('sourceType')}」不能连向「${type('targetType')}」`,
      'edge.source-not-allowed': (_, type) => `「${type('targetType')}」不接受来自「${type('sourceType')}」的连线`,
      'node.max-incoming': text => `入线最多 ${text('max')} 条，现有 ${text('count')} 条`,
      'node.max-outgoing': text => `出线最多 ${text('max')} 条，现有 ${text('count')} 条`,
      'port.max-connections': text => `端口「${text('port')}」最多连 ${text('max')} 条，现有 ${text('count')} 条`,
      'type.min-count': (text, type) => `至少需要 ${text('min')} 个「${type('type')}」，现有 ${text('count')} 个`,
      'type.max-count': (text, type) => `「${type('type')}」最多 ${text('max')} 个，现有 ${text('count')} 个`,
      'node.isolated': () => '没有任何连线',
      'node.missing-incoming': () => '缺少入线',
      'node.missing-outgoing': () => '缺少出线',
      'node.unreachable': () => '从开始节点走不到这里',
      'required': () => '必填',
      'invalid-type': () => '取值类型不对',
      'invalid-value': () => '取值不合法',
      'out-of-range': () => '超出允许的范围',
      'not-integer': () => '必须是整数',
      'invalid-option': () => '不在可选项里',
      'invalid-color': () => '不是有效的颜色',
      'empty': () => '不能为空',
      'unknown-key': () => '含有不认识的字段',
      'duplicate-key': () => '含有重复的键',
      'duplicate-id': () => '含有重复的 id',
      'unknown-control': () => '没有这种编辑方式',
    },
  },
})
