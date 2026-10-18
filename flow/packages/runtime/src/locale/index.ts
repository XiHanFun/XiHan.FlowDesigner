/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @xihan-flow/runtime/locale —— 流程的内建语言包，语言与 UI 的内建语言包一一对应。
//
// 每份含查看器、设计器与设计器零件（designer-shell）的文案，宿主用 mergeXhConfig 与 UI 同一语言的
// 语言包合并后交给 setXhConfig 或 <xh-config>。每种语言是独立的具名导出，打包器按引用摇树。

import type {} from '../translations'

export { flowDeDE } from './de-DE'
export { flowEnUS } from './en-US'
export { flowEsES } from './es-ES'
export { flowFrFR } from './fr-FR'
export { flowJaJP } from './ja-JP'
export { flowKoKR } from './ko-KR'
export { flowPtBR } from './pt-BR'
export { flowRuRU } from './ru-RU'
export type { FlowLocale } from './types'
export { flowZhCN } from './zh-CN'
export { flowZhTW } from './zh-TW'
