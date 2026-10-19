/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { FLOW_PANELS } from '@xihan-flow/designer'

// 设计器的布局：缺省只显示属性面板，物料、问题与小地图收起；重排工具栏与空白处的右键菜单，把一种警告关掉。

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

  // #region severity
  designer.validateOptions = { severity: { 'node.isolated': 'off' } }
  // #endregion severity
}
