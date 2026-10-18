# @xihan-flow/core

曦寒流程设计器的模型层：流程定义的类型、读入检查、校验与问题码、编辑操作（每一步都能求出逆操作）、连线几何、节点类型登记与扩展合并。纯 TypeScript，不依赖 DOM，浏览器与 Node 里都能用。

子入口 `@xihan-flow/core/presets/xihan-workflow` 是 XiHan 工作流引擎的节点预设：节点类型与引擎的活动类型一一对应，流程定义与引擎定义能互相转换。

**谁会装它**：在代码里读入、校验流程定义，或对接 XiHan 工作流引擎时直接引；只在页面上显示或设计流程时，装 `@xihan-flow/runtime` 或 `@xihan-flow/designer` 就会带上它。

## 用法

```ts
import { readDocument, validateDocument } from '@xihan-flow/core'
import { createXihanWorkflow } from '@xihan-flow/core/presets/xihan-workflow'

const read = readDocument(json)
if (read.ok) {
  const issues = validateDocument(read.document, { extensions: [createXihanWorkflow()] })
  const errors = issues.filter(issue => issue.severity === 'error')
}
```

## 装

```bash
pnpm add @xihan-flow/core
```

完整文档见 [https://flow.docs.xihanfun.com](https://flow.docs.xihanfun.com)。

许可：MIT
