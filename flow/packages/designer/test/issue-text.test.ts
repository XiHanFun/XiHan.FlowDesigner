/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type { FlowDesignerTranslations } from '@xihan-flow/runtime'
import { DEFAULT_ISSUE_SEVERITY } from '@xihan-flow/core'
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATIONS } from '../src/translations'

const names = { nodeType: (type: string): string => type }

describe('问题说明', () => {
  it('校验会给出的每个问题码，英文缺省与中文语言包都有说明，不把问题码原样交给用户', () => {
    const zh = (flowZhCN.translations as Record<string, Partial<FlowDesignerTranslations>>)['xh-flow-designer']!
    for (const code of Object.keys(DEFAULT_ISSUE_SEVERITY)) {
      const issue = { code, path: [], severity: 'error' as const, params: {} }
      expect(DEFAULT_TRANSLATIONS.issue(issue, names), code).not.toBe(code)
      expect(zh.issue!(issue, names), code).not.toBe(code)
    }
  })
})
