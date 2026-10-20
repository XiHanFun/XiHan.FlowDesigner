/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { FLOW_PANELS } from '@xihan-flow/designer'

// 设计器的布局：缺省只显示属性面板，物料、问题与小地图收起；重排工具栏与空白处的右键菜单，宿主的操作挂进菜单栏，把一种警告关掉。

export function customize(designer: HTMLElementTagNameMap['xh-flow-designer']): void {
  // #region default-layout
  designer.defaultLayout = { version: 1, hidden: [FLOW_PANELS.palette, FLOW_PANELS.issues, FLOW_PANELS.minimap] }
  // #endregion default-layout

  // #region command-layout
  designer.commandLayout = {
    'toolbar': [['undo', 'redo'], ['auto-layout'], ['zoom-to-fit', 'zoom-to-actual']],
    'menu:blank': [['paste'], ['auto-layout']],
  }
  // #endregion command-layout

  // #region host-menubar
  designer.extensions = [{
    id: 'acme.host',
    commands: [
      { id: 'acme.new', label: '新建', shortcut: ['Mod', 'Alt', 'N'], placement: ['menubar:file'], run: () => location.assign('/flows/new') },
      { id: 'acme.back', label: '返回列表', placement: ['menubar:file', 'toolbar'], run: () => history.back() },
    ],
  }]
  const title = document.createElement('span')
  title.slot = 'menubar-center'
  title.textContent = '请假审批 · LEAVE-01'
  const saved = document.createElement('span')
  saved.slot = 'status-end'
  saved.textContent = '已保存'
  designer.append(title, saved)
  // #endregion host-menubar

  // #region severity
  designer.validateOptions = { severity: { 'node.isolated': 'off' } }
  // #endregion severity
}
