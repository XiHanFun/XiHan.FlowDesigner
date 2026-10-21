来源：https://flow.docs.xihanfun.com/quickstart

# 快速开始

这一页在任意前端项目里装上运行时，把一张费用审批流显示出来，再逐步标出各节点的运行状态。页面上的示例就是下面这几段代码在运行。

## 安装

```bash
pnpm add @xihan-flow/core @xihan-flow/runtime @xihan-ui/styles
```

| 包 | 用途 |
| --- | --- |
| `@xihan-flow/core` | 流程定义的类型与 XiHan 工作流引擎的节点预设，这一页用它写流程 |
| `@xihan-flow/runtime` | `<xh-flow-viewer>` 查看器 |
| `@xihan-ui/styles` | 设计令牌与组件皮肤，查看器的颜色与间距都取自它 |

流程各包用到的 `@xihan-ui/*` 写在 peerDependencies 里，pnpm 与 npm 7 起会自动装上。项目里自己也用 XiHan.UI 时，流程与项目共用同一份，版本要落在各包 peerDependencies 写的范围里。

包都是 ESM，用 Vite、webpack 等打包器引入即可。

## 注册元素并引入样式

元素不在 import 时注册，调用 `defineFlowViewer()` 之后页面上才能用 `<xh-flow-viewer>`，重复调用不报错。`../schemas/approval` 是下一节写的流程定义。

```ts
import type { FlowNodeStatus } from '@xihan-flow/runtime'
import { defineFlowViewer } from '@xihan-flow/runtime'
import { extensions, schema } from '../schemas/approval'
import '@xihan-ui/styles/index.css'
import '@xihan-flow/runtime/style.css'

defineFlowViewer()
```

## 准备节点类型

流程里每个节点都有类型，类型决定节点的外观、端口、可以连到哪里以及有哪些属性。节点类型由扩展登记，这里直接用自带的 XiHan 工作流引擎节点预设，文案用中文：

```ts
/** 节点类型、属性与规则：XiHan 工作流引擎的节点预设，文案用中文。 */
export const workflow = createXihanWorkflow({ texts: xihanWorkflowZhCN })

export const extensions = [workflow]
```

## 写一张流程

流程定义是纯 JSON。节点写明类型、左上角坐标与尺寸，连线写明起止节点；标签、虚线、业务数据都是可选的。坐标单位是像素，原点在画布左上角。

```ts
export const schema: FlowDocument = {
  version: 1,
  data: { code: 'expense', name: '费用审批' },
  nodes: [
    { id: 'start', type: 'Start', x: 0, y: 104, width: 120, height: 40, label: '提交申请' },
    { id: 'dept', type: 'UserTask', x: 176, y: 100, width: 160, height: 48, label: '部门经理审批', data: { properties: { Assignees: ['部门经理'], CompletionPolicy: 'Any' } } },
    { id: 'amount', type: 'Decision', x: 400, y: 100, width: 160, height: 48, label: '金额判断' },
    { id: 'gm', type: 'UserTask', x: 624, y: 16, width: 160, height: 48, label: '总经理审批', data: { properties: { Assignees: ['总经理'], CompletionPolicy: 'Any' } } },
    { id: 'approved', type: 'End', x: 856, y: 104, width: 120, height: 40, label: '通过', data: { properties: { Outcome: 'approved' } } },
    { id: 'rejected', type: 'End', x: 400, y: 232, width: 120, height: 40, label: '驳回', data: { properties: { Outcome: 'rejected' } } },
  ],
  edges: [
    { id: 'submit', source: { node: 'start' }, target: { node: 'dept' } },
    { id: 'agree', source: { node: 'dept' }, target: { node: 'amount' }, label: '同意', data: { condition: 'outcome == "approved"' } },
    { id: 'reject', source: { node: 'dept' }, target: { node: 'rejected' }, label: '驳回', data: { condition: 'outcome == "rejected"' } },
    { id: 'large', source: { node: 'amount' }, target: { node: 'gm' }, label: '金额 > 1 万', data: { condition: 'amount > 10000', priority: 0 } },
    { id: 'small', source: { node: 'amount' }, target: { node: 'approved' }, label: '其余', style: { dashed: true }, data: { isDefault: true, priority: 1 } },
    { id: 'gm-agree', source: { node: 'gm' }, target: { node: 'approved' }, label: '同意' },
  ],
}
```

## 显示与标出运行状态

把扩展与流程定义交给 `<xh-flow-viewer>` 的 `extensions` 与 `schema` 属性，它立即画出流程并缩放到整张图落在视口里；属性变了会自动重画。复杂数据走属性，不走 attribute。

```ts
const viewer = document.createElement('xh-flow-viewer')
viewer.extensions = extensions
viewer.schema = schema
```

`setNodeStatuses` 按节点 id 标出运行状态，没列出的节点保持不变；把 `statuses` 设成空对象即清掉全部状态。皮肤为 `running`、`completed`、`waiting`、`faulted`、`canceled`、`compensated` 各画了一种样子：

```ts
let step = 0
const button = document.createElement('button')
button.type = 'button'
button.textContent = '下一步'
button.addEventListener('click', () => {
  if (step === steps.length) {
    step = 0
    viewer.statuses = {}
    return
  }
  viewer.setNodeStatuses(steps[step]!)
  step += 1
})
```


在画布上拖动或滚动滚轮可以平移，按住 Ctrl 或 ⌘ 滚动滚轮缩放；画布获得焦点后方向键平移，`+` 与 `-` 缩放，`0` 让整张图回到视口里。

## 中文界面

查看器与设计器的界面文字缺省是英文。流程的语言包与 XiHan.UI 的一一对应：`flowZhCN`、`flowZhTW`、`flowJaJP`、`flowKoKR`、`flowDeDE`、`flowFrFR`、`flowEsES`、`flowPtBR`、`flowRuRU` 与 `flowEnUS`，每份都含设计器零件的文案。把 XiHan.UI 同一语言的语言包与它合并后全局设置，所有实例都跟着换。下面以中文为例。这一步要另外安装 `@xihan-ui/web-components`：

```ts
import { flowZhCN } from '@xihan-flow/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { zhCN } from '@xihan-ui/web-components/locale'

setXhConfig(mergeXhConfig(zhCN, flowZhCN))
```

节点类型的名称与属性文案写在扩展里，换语言就换一个扩展：上面的预设传了 `xihanWorkflowZhCN`，所以节点类型是中文。预设的文案同样有这十种语言，名字是 `xihanWorkflow` 加语言，如 `xihanWorkflowJaJP`。

## 下一步

- [流程定义结构](./guide/schema)：节点、连线、业务数据与扩展数据。
- [查看器](./guide/viewer)：运行状态、高亮、定位与事件。
- [设计器](./guide/designer)：可视化编辑流程定义，撤销与保存。
- [介绍](./introduction)：包与入口、工作流程。
