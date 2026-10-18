/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器自己的设置分区「画布」：自动布局的方向与间距、小地图、吸附对齐。值的键是 flow.<条目 id>，
// 设计器与扩展从上下文的 settings 读。

import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import type { DesignerSettingItem, DesignerSettings, DesignerSettingsSection } from '@xihan-ui/designer-shell'
import type { LayeredDirection } from '@xihan-ui/viz/graph'
import { settingKey, settingValue } from '@xihan-ui/designer-shell'

/** 设计器自己那个设置分区的 id，扩展不能再用。宿主给缺省或读设置时用它与 FLOW_SETTING_KEYS，不手写字符串。 */
export const FLOW_SETTINGS_SECTION = 'flow'

/** 「画布」分区各条目的键，即 settings 里的键（分区 id.条目 id）。 */
export const FLOW_SETTING_KEYS = {
  layoutDirection: 'flow.layoutDirection',
  nodeGap: 'flow.nodeGap',
  layerGap: 'flow.layerGap',
  minimap: 'flow.minimap',
  snap: 'flow.snap',
} as const

const DIRECTIONS: readonly LayeredDirection[] = ['TB', 'LR', 'BT', 'RL']

/** 「画布」分区：自动布局的缺省方向与两种间距与 autoLayout 的缺省一致。 */
export function flowSettingsSection(t: FlowDesignerTranslations): DesignerSettingsSection {
  return {
    id: FLOW_SETTINGS_SECTION,
    label: t.settingsCanvas,
    order: 100,
    items: [
      {
        path: ['layoutDirection'],
        label: t.settingsLayoutDirection,
        control: { kind: 'select', appearance: 'toggle', options: DIRECTIONS.map(value => ({ value, label: t.settingsLayoutDirections[value] })) },
        default: 'TB',
        meta: { description: t.settingsLayoutDirectionHint },
      },
      { path: ['nodeGap'], label: t.settingsNodeGap, control: { kind: 'number', min: 0, step: 4, unit: 'px' }, default: 24, meta: { description: t.settingsNodeGapHint } },
      { path: ['layerGap'], label: t.settingsLayerGap, control: { kind: 'number', min: 0, step: 4, unit: 'px' }, default: 48, meta: { description: t.settingsLayerGapHint } },
      { path: ['minimap'], label: t.settingsMinimap, control: { kind: 'boolean' }, default: true, meta: { description: t.settingsMinimapHint } },
      { path: ['snap'], label: t.settingsSnap, control: { kind: 'boolean' }, default: true, meta: { description: t.settingsSnapHint } },
    ],
  }
}

/** 此刻生效的设置：写了的键原样保留，各分区里没写的条目取缺省值。 */
export function resolveSettings(sections: readonly DesignerSettingsSection[], settings: DesignerSettings | undefined): DesignerSettings {
  const resolved: Record<string, DesignerSettings[string]> = { ...settings }
  for (const section of sections) {
    for (const item of section.items as readonly DesignerSettingItem[]) {
      const value = settingValue(settings, section, item)
      if (value !== undefined)
        resolved[settingKey(section, item)] = value
    }
  }
  return resolved
}
