/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 流程产品的中文文案，查看器与设计器共用：与 UI 的语言包一起交给 mergeXhConfig，再经 setXhConfig 或 <xh-config> 生效。

import type { XhConfig } from '@xihan-ui/web-components'
import type {} from './translations'

/** 流程查看器与设计器的中文文案。 */
export const flowZhCN: XhConfig = {
  translations: {
    'xh-flow-viewer': { label: '流程图' },
    'xh-flow-designer': { label: '流程设计器' },
  },
}
