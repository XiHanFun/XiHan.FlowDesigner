/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的设置：宿主管着主题，用户偏好存在宿主自己那里；独立使用时交给本机存储；从工具栏外的按钮打开设置。

import type { XhFlowDesigner } from '@xihan-flow/designer'

type FlowSettings = NonNullable<XhFlowDesigner['settings']>

// #region host
export function wireSettings(designer: XhFlowDesigner, saved: FlowSettings, store: (settings: FlowSettings) => void): void {
  designer.settings = saved
  designer.settingsPolicy = { 'general.theme': 'hidden', 'general.brand': 'hidden', 'flow.snap': 'locked' }
  designer.addEventListener('settings-change', (event) => {
    store((event as CustomEvent<{ settings: FlowSettings }>).detail.settings)
  })
}
// #endregion host

// #region storage
export function standalone(designer: XhFlowDesigner): void {
  designer.settingsStorageKey = 'flow-designer:settings'
  designer.addEventListener('settings-storage-error', (event) => {
    console.warn('设置没能读写本机存储，这次改的只在内存里', (event as CustomEvent<{ error: unknown }>).detail.error)
  })
}
// #endregion storage

// #region open
export function openCanvasSettings(designer: XhFlowDesigner): void {
  designer.openSettings('flow')
}
// #endregion open
