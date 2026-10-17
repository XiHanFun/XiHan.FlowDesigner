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

包都是 ESM，用 Vite、webpack 等打包器引入即可。

## 注册元素并引入样式

元素不在 import 时注册，调用 `defineFlowViewer()` 之后页面上才能用 `<xh-flow-viewer>`，重复调用不报错。`../schemas/approval` 是下一节写的流程定义。

<<< @/examples/demos/quickstart.ts#setup

## 准备节点类型

流程里每个节点都有类型，类型决定节点的外观、端口、可以连到哪里以及有哪些属性。节点类型由扩展登记，这里直接用自带的 XiHan 工作流引擎节点预设，文案用中文：

<<< @/examples/schemas/approval.ts#extensions

## 写一张流程

流程定义是纯 JSON。节点写明类型、左上角坐标与尺寸，连线写明起止节点；标签、虚线、业务数据都是可选的。坐标单位是像素，原点在画布左上角。

<<< @/examples/schemas/approval.ts#schema

## 显示与标出运行状态

把扩展与流程定义交给 `<xh-flow-viewer>` 的 `extensions` 与 `schema` 属性，它立即画出流程并缩放到整张图落在视口里；属性变了会自动重画。复杂数据走属性，不走 attribute。

<<< @/examples/demos/quickstart.ts#render

`setNodeStatuses` 按节点 id 标出运行状态，没列出的节点保持不变；把 `statuses` 设成空对象即清掉全部状态。皮肤为 `running`、`completed`、`waiting`、`faulted`、`canceled`、`compensated` 各画了一种样子：

<<< @/examples/demos/quickstart.ts#status

<FlowDemo name="quickstart" />

在画布上拖动或滚动滚轮可以平移，按住 Ctrl 或 ⌘ 滚动滚轮缩放；画布获得焦点后方向键平移，`+` 与 `-` 缩放，`0` 让整张图回到视口里。

## 中文界面

查看器与设计器的界面文字缺省是英文。把 XiHan.UI 的中文语言包与流程的中文语言包合并后全局设置，所有实例都跟着换。这一步要另外安装 `@xihan-ui/web-components`：

<<< @/examples/snippets/locale.ts#example

节点类型的名称与属性文案写在扩展里，换语言就换一个扩展：上面的预设传了 `xihanWorkflowZhCN`，所以节点类型是中文。

## 下一步

- [流程定义结构](./guide/schema)：节点、连线、业务数据与扩展数据。
- [介绍](./introduction)：包与入口、工作流程。
