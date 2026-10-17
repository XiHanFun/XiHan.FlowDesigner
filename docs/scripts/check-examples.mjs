/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 校验 examples/schemas/ 下的示例流程定义：每个文件导出 schema 与 extensions。
// 流程定义转成 JSON 再读入要通过 readDocument，按它的扩展校验不能有错误级问题。

import { readdir } from 'node:fs/promises'
import process from 'node:process'
import { readDocument, validateDocument } from '@xihan-flow/core'

const schemasDir = new URL('../examples/schemas/', import.meta.url)

const failures = []
const files = (await readdir(schemasDir)).filter(name => name.endsWith('.ts')).sort()
for (const name of files) {
  const { schema, extensions } = await import(new URL(name, schemasDir).href)
  const read = readDocument(JSON.parse(JSON.stringify(schema)))
  if (!read.ok) {
    failures.push(`${name}：读入问题 ${read.issues.map(issue => `${issue.code} @ ${issue.path.join('.')}`).join('，')}`)
    continue
  }
  const issues = validateDocument(read.document, { extensions })
  const errors = issues.filter(issue => issue.severity === 'error')
  const warnings = issues.filter(issue => issue.severity === 'warning').map(issue => issue.code)
  if (errors.length > 0)
    failures.push(`${name}：校验问题 ${errors.map(issue => `${issue.code} @ ${issue.path.join('.')}`).join('，')}`)
  else
    console.log(`${name}：${read.document.nodes.length} 个节点、${read.document.edges.length} 条连线${warnings.length > 0 ? `，警告 ${warnings.join('、')}` : ''}`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
