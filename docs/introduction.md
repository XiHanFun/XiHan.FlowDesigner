# 介绍

曦寒流程设计器（XiHan.FlowDesigner）是一款框架无关的流程设计器：以原生 Web Components 交付，用查看器显示流程与每个节点的运行状态，用设计器可视化编辑流程。节点类型、属性、校验规则、渲染、命令与面板都经扩展登记；自带 XiHan.Framework 工作流引擎的节点预设，流程定义能与引擎定义互相转换。属于曦寒懿（XiHanFun）开源生态，采用 MIT 授权。

## 能做什么

| 场景 | 用什么 |
| --- | --- |
| 在业务页面里显示流程与运行进度 | `<xh-flow-viewer>`：按节点类型画出流程，标出运行状态与高亮，缩放、平移、定位节点 |
| 设计与修改流程 | `<xh-flow-designer>`：物料拖放、连线与改连、对齐吸附、属性面板、问题列表、小地图、撤销重做与剪贴板 |
| 在服务端或脚本里检查流程定义 | `@xihan-flow/core` 的 `readDocument` 与 `validateDocument`，不依赖 DOM |
| 对接 XiHan 工作流引擎 | `@xihan-flow/core/presets/xihan-workflow`：引擎活动对应的节点类型，与引擎定义 JSON 互转 |

## 设计原则

- **框架无关**：以原生 Web Components 交付，不绑定任何前端框架。元素用 Light DOM，样式只消费 [XiHan.UI](https://ui.docs.xihanfun.com) 的设计令牌。
- **零第三方依赖**：运行时只依赖 `@xihan-flow/*` 与 `@xihan-ui/*`，布局、连线路由、指针手势与设计器的外框、面板都来自 XiHan.UI。
- **流程定义即数据**：流程定义是纯 JSON，不含也不执行任何代码；读入时逐项检查结构，带问题的定义不会被当成合法数据。
- **一切经扩展登记**：节点类型、属性、编辑方式、校验规则、渲染、命令与面板都由按实例传入的扩展登记。名字冲突在赋值时当场报错，去掉一个扩展就撤掉它带来的一切。
- **数据由使用方掌控**：组件不发网络请求。流程定义存在哪里、谁能改，都由使用方决定，经属性与事件交给组件。
- **没有全局状态**：不往 `window` 上挂对象，不读写固定键名的本地存储，同一页面放多个实例互不影响。

## 包与入口

| 入口 | 内容 |
| --- | --- |
| `@xihan-flow/core` | 流程定义的类型、读入检查、校验、编辑操作、连线几何、节点类型登记与扩展合并。纯 TypeScript，不依赖 DOM，浏览器与 Node.js 里都能用 |
| `@xihan-flow/core/presets/xihan-workflow` | XiHan 工作流引擎的节点预设，以及流程定义与引擎定义的互转 |
| `@xihan-flow/runtime` | 业务页面用的 `<xh-flow-viewer>` 与直角连线路由，样式在 `@xihan-flow/runtime/style.css` |
| `@xihan-flow/runtime/locale` | 中文语言包 `flowZhCN`，查看器与设计器共用 |
| `@xihan-flow/designer` | `<xh-flow-designer>`，样式在 `@xihan-flow/designer/style.css` |

依赖方向固定为 `designer → runtime → core`。业务页面只需要 runtime，设计器只在需要编辑流程的地方加载。

## 工作流程

```text
设计器 <xh-flow-designer>
  │  schema-change / save 事件
  ▼
宿主保存流程定义 JSON（数据库、文件，由宿主决定）
  │
  ├─ 业务页面取出流程定义与运行状态 ──▶ <xh-flow-viewer> 显示进度
  └─ 用 XiHan 工作流引擎时转成引擎定义 ──▶ 引擎发布与运行
```

1. 设计：在设计器里编辑流程，设计器派发 `schema-change` 与 `save`，宿主把流程定义存起来。
2. 查看：业务页面取出流程定义与各节点的运行状态，交给查看器显示。
3. 运行：用 XiHan 工作流引擎时，用预设把流程定义转成引擎定义交给引擎；从引擎取回的定义也能转回流程定义继续编辑。

## 运行环境

- `@xihan-flow/core` 不依赖 DOM，可以在浏览器、Node.js 或其它 JavaScript 运行环境里读入与校验流程定义。
- `@xihan-flow/runtime` 与 `@xihan-flow/designer` 要在支持 Custom Elements 的浏览器里运行。

## 下一步

- [快速开始](./quickstart)：在任意前端项目里装包，显示一张审批流并标出运行状态。
- [流程定义结构](./guide/schema)：节点、连线、业务数据与扩展数据，读入、校验与编辑操作。
- [查看器](./guide/viewer)：运行状态、高亮、定位、事件与自定义节点内容。
