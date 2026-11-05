<div align="center">

<h1>XiHan.FlowDesigner</h1>

<h3>快速、轻量、高效、用心的框架无关流程设计器</h3>

<p>
  <a href="https://github.com/XiHanFun/XiHan.FlowDesigner/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/XiHanFun/XiHan.FlowDesigner/ci.yml?branch=dev&style=flat-square&label=CI" /></a>
  <a href="https://www.npmjs.com/package/@xihan-flow/designer"><img alt="npm" src="https://img.shields.io/npm/v/@xihan-flow/designer?style=flat-square&logo=npm&logoColor=white&color=cb3837" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/XiHanFun/XiHan.FlowDesigner?style=flat-square&color=green" /></a>
  <a href="https://github.com/XiHanFun/XiHan.FlowDesigner/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/XiHanFun/XiHan.FlowDesigner?style=flat-square&logo=github&label=Stars&color=1f6feb" /></a>
  <a href="https://gitee.com/XiHanFun/XiHan.FlowDesigner"><img alt="Gitee Stars" src="https://gitee.com/XiHanFun/XiHan.FlowDesigner/badge/star.svg" /></a>
  <a href="https://gitcode.com/XiHanFun/XiHan.FlowDesigner"><img alt="GitCode Stars" src="https://gitcode.com/XiHanFun/XiHan.FlowDesigner/star/badge.svg" /></a>
</p>

<p>
  <a href="https://flow.docs.xihanfun.com"><b>文档</b></a> ·
  <a href="#快速开始"><b>快速开始</b></a> ·
  <a href="https://flow.docs.xihanfun.com/changelog"><b>更新日志</b></a>
</p>

<p><a href="./README.md">English</a> | <b>简体中文</b></p>

</div>

XiHan.FlowDesigner 是框架无关的流程设计器，以 Web Components 交付，可视化编排流程图与审批流，产出与引擎无关的流程定义，属曦寒懿（XiHanFun）开源生态。

## 特性

| 特性 | 说明 |
| --- | --- |
| 框架无关 | 原生 Web Components，适用于 Vue、React、Angular 与无框架页面 |
| 零第三方依赖 | 运行时不引入第三方包 |
| 模板即数据 | 模板为 JSON，不含也不执行代码 |
| 数据自主 | 组件不发网络请求，数据、存储与权限经回调交由使用方 |
| 引擎无关 | 产出通用流程定义，由使用方对接流程引擎 |

## 快速开始

```bash
pnpm add @xihan-flow/core @xihan-flow/runtime @xihan-ui/styles
```

```ts
import { defineFlowViewer } from '@xihan-flow/runtime'
import '@xihan-ui/styles/index.css'
import '@xihan-flow/runtime/style.css'

defineFlowViewer()

const viewer = document.createElement('xh-flow-viewer')
viewer.extensions = extensions
viewer.schema = schema
document.body.append(viewer)
```

流程定义与节点类型的写法见[快速开始](https://flow.docs.xihanfun.com/quickstart)。

## 包结构

| 包 | 说明 |
| --- | --- |
| `@xihan-flow/core` | 模型层：流程 schema、校验、布局算法与编辑命令，不依赖 DOM |
| `@xihan-flow/runtime` | 运行时：流程图查看与运行状态展示 |
| `@xihan-flow/designer` | 设计器：可视化流程设计 |

依赖方向为 `designer → runtime → core`，业务页面仅需 `runtime`。

## 本地开发

需 Node.js 24+ 与 pnpm 11+，开发预览页位于 `http://localhost:5190`。

```bash
cd flow
pnpm install
pnpm dev
```

## 生态

| 项目 | 说明 |
| --- | --- |
| [XiHan.Framework](https://github.com/XiHanFun/XiHan.Framework) | .NET 微内核开发框架 |
| [XiHan.UI](https://github.com/XiHanFun/XiHan.UI) | 框架无关 Headless UI 组件库 |
| [XiHan.BasicApp](https://github.com/XiHanFun/XiHan.BasicApp) | 基于 XiHan.Framework 和 XiHan.UI 的超高颜值通用中后台内核 |
| [XiHan.FormDesigner](https://github.com/XiHanFun/XiHan.FormDesigner) | 框架无关表单设计器 |
| [XiHan.PrintDesigner](https://github.com/XiHanFun/XiHan.PrintDesigner) | 框架无关打印设计器 |
| [XiHan.ReportDesigner](https://github.com/XiHanFun/XiHan.ReportDesigner) | 框架无关报表设计器 |

## 文档

[查看器](https://flow.docs.xihanfun.com/guide/viewer) · [设计器](https://flow.docs.xihanfun.com/guide/designer) · [流程定义](https://flow.docs.xihanfun.com/guide/schema) · [更新日志](https://flow.docs.xihanfun.com/changelog)

## 参与

欢迎提交 [Issue](https://github.com/XiHanFun/XiHan.FlowDesigner/issues) 与 Pull Request，提交遵循 Conventional Commits，改动须通过 CI 门禁。交流：QQ 群 [462371834](https://qm.qq.com/q/qYp1Urv3z2)。支持项目：[赞助页](https://docs.xihanfun.com/cosmos/sponsor)。

## 许可证

[MIT](./LICENSE) © 2021-Present XiHanFun and contributors。XiHan.FlowDesigner 的名称、界面视觉设计与原创视觉表达归作者所有。
