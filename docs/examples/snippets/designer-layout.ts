/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的布局：只留工具栏与属性面板，重排工具栏与空白处的右键菜单，把一种警告关掉。

export function customize(designer: HTMLElementTagNameMap['xh-flow-designer']): void {
  // #region panels
  designer.panels = 'toolbar properties'
  // #endregion panels

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
