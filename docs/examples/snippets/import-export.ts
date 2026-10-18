/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导入与导出：打开或拖进来的 .json 文件读成整份流程定义，导出时把当前定义写成 JSON 文本，由宿主存成文件。

import type { FlowDesignerExtension } from '@xihan-flow/designer'
import { readDocument } from '@xihan-flow/core'

// #region importers
export const jsonFiles: FlowDesignerExtension = {
  id: '@example/json-files',
  importers: [{
    id: '@example/json-files.open',
    accepts: source => source.file !== undefined && (source.mime === 'application/json' || source.name?.endsWith('.json') === true),
    import: async (source) => {
      const read = readDocument(JSON.parse(await source.file!.text()))
      if (!read.ok)
        throw new TypeError('这个文件不是流程定义')
      return { document: read.document }
    },
  }],
  exporters: [{
    id: '@example/json-files.save',
    label: '流程定义（JSON）',
    formats: ['json'],
    export: async (_format, { designer }) => JSON.stringify(designer.schema, null, 2),
  }],
}
// #endregion importers

// #region export
export function wire(designer: HTMLElementTagNameMap['xh-flow-designer']): void {
  designer.extensions = [jsonFiles]
  designer.addEventListener('import-error', (event) => {
    const { importer, error } = (event as CustomEvent<{ importer?: string, error: unknown }>).detail
    console.warn(importer ?? '没有导入器接下这个文件', error)
  })
}

export async function save(designer: HTMLElementTagNameMap['xh-flow-designer']): Promise<void> {
  const text = await designer.export('json')
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: 'flow.json' })
  link.click()
  URL.revokeObjectURL(url)
}
// #endregion export
