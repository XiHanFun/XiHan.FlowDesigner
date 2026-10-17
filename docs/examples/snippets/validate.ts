/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 从存储取回的 JSON 先读入、再按扩展校验：结构不对直接拒收，错误级问题交给界面提示。

import type { FlowDocument, FlowIssue } from '@xihan-flow/core'

// #region example
import { readDocument, validateDocument } from '@xihan-flow/core'
import { extensions } from '../schemas/approval'

export function load(json: string): { document: FlowDocument, errors: FlowIssue[] } {
  const read = readDocument(JSON.parse(json))
  if (!read.ok)
    throw new Error(read.issues.map(issue => `${issue.code} @ ${issue.path.join('.')}`).join('\n'))
  const issues = validateDocument(read.document, {
    extensions,
    severity: { 'node.unreachable': 'off' },
  })
  return { document: read.document, errors: issues.filter(issue => issue.severity === 'error') }
}
// #endregion example
