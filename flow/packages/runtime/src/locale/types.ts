/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 一种语言的流程文案：查看器与设计器各一份，都是全量的；与 designer-shell 同一语言的那份合成一个语言包。

import type { XhConfig } from '@xihan-ui/web-components'
import type { FlowDesignerLocale } from '../designer-locale'
import type { FlowViewerTranslations } from '../translations'
import { mergeXhConfig } from '@xihan-ui/web-components'
import { flowDesignerTranslations } from '../designer-locale'

/** 流程一种语言的全部文案。 */
export interface FlowLocale {
  readonly viewer: FlowViewerTranslations
  readonly designer: FlowDesignerLocale
}

/** 把流程文案与 designer-shell 同一语言的那份合成一个语言包。 */
export function flowLocale(shell: XhConfig, locale: FlowLocale): XhConfig {
  return mergeXhConfig(shell, {
    translations: {
      'xh-flow-viewer': locale.viewer,
      'xh-flow-designer': flowDesignerTranslations(locale.designer),
    },
  })
}
