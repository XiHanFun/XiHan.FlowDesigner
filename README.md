<div align="center">

<h1>XiHan.FlowDesigner</h1>

<h3>A fast, lightweight, efficient and thoughtfully built framework-agnostic flow designer</h3>

<p>
  <a href="https://github.com/XiHanFun/XiHan.FlowDesigner/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/XiHanFun/XiHan.FlowDesigner/ci.yml?branch=dev&style=flat-square&label=CI" /></a>
  <a href="https://www.npmjs.com/package/@xihan-flow/designer"><img alt="npm" src="https://img.shields.io/npm/v/@xihan-flow/designer?style=flat-square&logo=npm&logoColor=white&color=cb3837" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/XiHanFun/XiHan.FlowDesigner?style=flat-square&color=green" /></a>
  <a href="https://github.com/XiHanFun/XiHan.FlowDesigner/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/XiHanFun/XiHan.FlowDesigner?style=flat-square&logo=github&label=Stars&color=1f6feb" /></a>
  <a href="https://gitee.com/XiHanFun/XiHan.FlowDesigner"><img alt="Gitee Stars" src="https://gitee.com/XiHanFun/XiHan.FlowDesigner/badge/star.svg" /></a>
  <a href="https://gitcode.com/XiHanFun/XiHan.FlowDesigner"><img alt="GitCode Stars" src="https://gitcode.com/XiHanFun/XiHan.FlowDesigner/star/badge.svg" /></a>
</p>

<p>
  <a href="https://flow.docs.xihanfun.com"><b>Docs</b></a> ·
  <a href="#getting-started"><b>Getting Started</b></a> ·
  <a href="https://flow.docs.xihanfun.com/changelog"><b>Changelog</b></a>
</p>

<p><b>English</b> | <a href="./README_cn.md">简体中文</a></p>

</div>

XiHan.FlowDesigner is a framework-agnostic flow designer delivered as Web Components. It builds flowcharts and approval flows visually and produces engine-independent definitions. It is part of the XiHanFun open-source ecosystem.

## Features

| Feature | Description |
| --- | --- |
| Framework-agnostic | Native Web Components for Vue, React, Angular and pages without a framework |
| No third-party dependencies | Nothing third-party at runtime |
| Templates are data | Templates are JSON that neither contain nor execute code |
| Data stays with you | Components make no network requests; data, storage and permissions go through callbacks |
| Engine-independent | Produces neutral flow definitions for the consumer to connect to an engine |

## Getting Started

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

Flow definitions and node types are covered in the [quickstart](https://flow.docs.xihanfun.com/quickstart).

## Packages

| Package | Description |
| --- | --- |
| `@xihan-flow/core` | Model layer: flow schema, validation, layout algorithms and editing commands, with no DOM dependency |
| `@xihan-flow/runtime` | Runtime: flowchart viewing and run status display |
| `@xihan-flow/designer` | Designer: visual flow design |

Dependencies run `designer → runtime → core`, and business pages only need `runtime`.

## Local Development

Requires Node.js 24+ and pnpm 11+. The development preview runs at `http://localhost:5190`.

```bash
cd flow
pnpm install
pnpm dev
```

## Ecosystem

| Project | Description |
| --- | --- |
| [XiHan.Framework](https://github.com/XiHanFun/XiHan.Framework) | .NET microkernel development framework |
| [XiHan.UI](https://github.com/XiHanFun/XiHan.UI) | Framework-agnostic headless UI component library |
| [XiHan.BasicApp](https://github.com/XiHanFun/XiHan.BasicApp) | A beautifully crafted general-purpose admin kernel built on XiHan.Framework and XiHan.UI |
| [XiHan.FormDesigner](https://github.com/XiHanFun/XiHan.FormDesigner) | Framework-agnostic form designer |
| [XiHan.PrintDesigner](https://github.com/XiHanFun/XiHan.PrintDesigner) | Framework-agnostic print designer |
| [XiHan.ReportDesigner](https://github.com/XiHanFun/XiHan.ReportDesigner) | Framework-agnostic report designer |

## Documentation

The documentation site is written in Chinese.

[Viewer](https://flow.docs.xihanfun.com/guide/viewer) · [Designer](https://flow.docs.xihanfun.com/guide/designer) · [Flow definitions](https://flow.docs.xihanfun.com/guide/schema) · [Changelog](https://flow.docs.xihanfun.com/changelog)

## Contributing

[Issues](https://github.com/XiHanFun/XiHan.FlowDesigner/issues) and pull requests are welcome. Commits follow Conventional Commits, and changes must pass the CI gates. Community: QQ group [462371834](https://qm.qq.com/q/qYp1Urv3z2). Support the project: [sponsorship page](https://docs.xihanfun.com/cosmos/sponsor).

## License

[MIT](./LICENSE) © 2021-Present XiHanFun and contributors. The XiHan.FlowDesigner name, interface design and original visual expression belong to the author.
