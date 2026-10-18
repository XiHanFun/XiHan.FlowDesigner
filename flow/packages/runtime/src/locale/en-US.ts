/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程的英文语言包，与查看器、设计器不配语言包时的缺省文案相同。

import type { XhConfig } from '@xihan-ui/web-components'
import { designerShellEnUS } from '@xihan-ui/designer-shell/locale'
import { FLOW_DESIGNER_EN_US } from '../designer-locale'
import { DEFAULT_FLOW_VIEWER_TRANSLATIONS } from '../translations'
import { flowLocale } from './types'

/** 流程的英文文案：查看器、设计器与 designer-shell 零件。 */
export const flowEnUS: XhConfig = /* @__PURE__ */ flowLocale(designerShellEnUS, {
  viewer: DEFAULT_FLOW_VIEWER_TRANSLATIONS,
  designer: FLOW_DESIGNER_EN_US,
})
