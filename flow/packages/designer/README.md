# @xihan-flow/designer

曦寒流程设计器：`<xh-flow-designer>` 可视化编辑流程，包括物料拖放、连线与改连、对齐吸附、自动布局、属性面板、问题列表、小地图、撤销重做与剪贴板，以及设置对话框。以原生 Web Components 交付，任何前端项目都能用。设计器只改流程定义、派发事件，流程定义的保存与权限由宿主负责。

设计器用到 XiHan.UI 的设计器零件，样式要四份一起引入（见下面的用法）。节点类型、属性、编辑方式、校验规则、节点渲染、属性编辑器、命令、面板、设置分区与导入导出都能经 `extensions` 登记。

## 用法

```ts
import { createXihanWorkflow } from '@xihan-flow/core/presets/xihan-workflow'
import { defineFlowDesigner } from '@xihan-flow/designer'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-flow/runtime/style.css'
import '@xihan-flow/designer/style.css'

defineFlowDesigner()

const designer = document.createElement('xh-flow-designer')
designer.extensions = [createXihanWorkflow()]
designer.schema = schema
designer.addEventListener('schema-change', () => save(designer.schema))
document.body.append(designer)
```

## 装

```bash
pnpm add @xihan-flow/core @xihan-flow/designer @xihan-flow/runtime @xihan-ui/styles @xihan-ui/designer-shell
```

完整文档见 [https://flow.docs.xihanfun.com](https://flow.docs.xihanfun.com)。

许可：MIT
