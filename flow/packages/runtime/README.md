# @xihan-flow/runtime

曦寒流程设计器的运行时，给业务页面用：`<xh-flow-viewer>` 按节点类型画出流程，标出运行状态与高亮，缩放、平移、定位节点，导出图片。以原生 Web Components 交付，任何前端项目都能用。

子入口：

- `@xihan-flow/runtime/locale`：界面语言包（`flowZhCN`、`flowJaJP`……），与 XiHan.UI 的内建语言一一对应，查看器与设计器共用。
- `@xihan-flow/runtime/style.css`：查看器的样式，只消费 `@xihan-ui/styles` 的设计令牌。

## 用法

```ts
import { createXihanWorkflow } from '@xihan-flow/core/presets/xihan-workflow'
import { defineFlowViewer } from '@xihan-flow/runtime'
import '@xihan-ui/styles/index.css'
import '@xihan-flow/runtime/style.css'

defineFlowViewer()

const viewer = document.createElement('xh-flow-viewer')
viewer.extensions = [createXihanWorkflow()]
viewer.schema = schema
viewer.setNodeStatuses({ start: 'completed', dept: 'running' })
document.body.append(viewer)
```

## 装

```bash
pnpm add @xihan-flow/core @xihan-flow/runtime @xihan-ui/styles
```

完整文档见 [https://flow.docs.xihanfun.com](https://flow.docs.xihanfun.com)。

许可：MIT
