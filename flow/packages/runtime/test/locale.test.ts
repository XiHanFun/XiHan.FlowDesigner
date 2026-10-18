/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { XhConfig } from '@xihan-ui/web-components'
import type { FlowDesignerTranslations, FlowViewerTranslations } from '../src'
import { DEFAULT_ISSUE_SEVERITY } from '@xihan-flow/core'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FLOW_DESIGNER_TRANSLATIONS } from '../src'
import * as locales from '../src/locale'

const names = { nodeType: (type: string): string => `<${type}>` }
const PACKS = Object.entries(locales) as [string, XhConfig][]

function bucket<T>(pack: XhConfig, tag: string): T {
  return (pack.translations as Record<string, T>)[tag]!
}

describe('流程语言包', () => {
  it('十种语言与 UI 的语言包一一对应，各含查看器、设计器与 designer-shell 零件的文案', () => {
    expect(PACKS.map(([name]) => name).sort()).toEqual(['flowDeDE', 'flowEnUS', 'flowEsES', 'flowFrFR', 'flowJaJP', 'flowKoKR', 'flowPtBR', 'flowRuRU', 'flowZhCN', 'flowZhTW'])
    for (const [, pack] of PACKS) {
      expect(bucket<FlowViewerTranslations>(pack, 'xh-flow-viewer').label).not.toBe('')
      expect(Object.keys(pack.translations!).some(tag => tag.startsWith('xh-designer-'))).toBe(true)
    }
  })

  it('校验会给出的每个问题码，每种语言都有说明，参数与节点类型名都填进去，不把问题码原样交给用户', () => {
    const designers: [string, FlowDesignerTranslations][] = [['default', DEFAULT_FLOW_DESIGNER_TRANSLATIONS], ...PACKS.map(([name, pack]): [string, FlowDesignerTranslations] => [name, bucket(pack, 'xh-flow-designer')])]
    for (const [name, designer] of designers) {
      for (const code of Object.keys(DEFAULT_ISSUE_SEVERITY)) {
        const text = designer.issue({ code, path: [], params: { type: 'task', sourceType: 'a', targetType: 'b', id: 'n1', node: 'n2', port: 'p', max: 1, min: 1, count: 2, version: 9 } }, names)
        expect(text, `${name} ${code}`).not.toBe(code)
        expect(text, `${name} ${code}`).not.toMatch(/undefined|\$\{|\{\w+\}/)
      }
      expect(designer.issue({ code: 'acme.custom', path: [] }, names)).toBe('acme.custom')
      expect(designer.propertyLabel('style.dashed')).not.toBe('style.dashed')
      expect(designer.propertyLabel('data.custom')).toBe('data.custom')
    }
  })

  it('英文语言包与不配语言包时的缺省文案相同', () => {
    expect(bucket<FlowDesignerTranslations>(locales.flowEnUS, 'xh-flow-designer').undo).toBe(DEFAULT_FLOW_DESIGNER_TRANSLATIONS.undo)
    expect(bucket<FlowViewerTranslations>(locales.flowEnUS, 'xh-flow-viewer').label).toBe('Flow diagram')
  })
})
