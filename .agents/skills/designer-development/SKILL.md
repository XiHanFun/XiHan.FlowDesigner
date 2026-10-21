---
name: xihan-flow-designer-development
description: 实现、重构、修复或测试 XiHan.FlowDesigner 的流程定义、查看器、设计器与扩展点时使用。覆盖 core / runtime / designer 分层、元素的属性事件方法、extensions 登记、复用 XiHan.UI、变更集与门禁；XiHan 工作流引擎预设用 xihan-flow-workflow-preset，文档站用 xihan-flow-docs-site。
---

# XiHan.FlowDesigner 设计器开发

## 先定落在哪一层

依赖方向固定为 `designer → runtime → core`，不得反向。

| 包 | 放什么 | 主要文件（`flow/packages/<包>/src/`） |
| --- | --- | --- |
| `@xihan-flow/core` | 流程定义的类型与结构、读入、校验与问题码、编辑操作（都能求逆操作）、连线几何、节点类型登记与扩展合并；纯 TypeScript，tsconfig 不含 DOM | `schema.ts`、`read.ts`、`validate.ts`、`issues.ts`、`operations.ts`、`geometry.ts`、`registry.ts`、`extensions.ts`、`presets/` |
| `@xihan-flow/runtime` | 业务页面用的 `<xh-flow-viewer>`：场景、直角连线路由、节点渲染、导出图片、语言包；体积敏感，设计器专用的代码不进来 | `flow-viewer.ts`、`scene.ts`、`router.ts`、`node-renderer.ts`、`image-export.ts`、`locale/` |
| `@xihan-flow/designer` | `<xh-flow-designer>`：编辑模型、剪贴板、面板、设置、历史说明、内置命令与菜单栏、引导 | `flow-designer.ts`、`editor.ts`、`extensions.ts`、`settings.ts`、`panels/`、`clipboard.ts` |

## 硬性约定

- **模板即数据**：流程定义是纯 JSON，禁止 `eval`、`new Function`、动态插入脚本和把用户内容拼进 `innerHTML`；未知输入先过 `readDocument`。
- **对外契约**：属性叫 `schema`、变化事件叫 `schema-change`，事件用 `CustomEvent`、名字用短横线不带前缀；复杂数据走 property；公开方法、事件、属性都有类型声明与注释（参考页从注释生成）。
- **经扩展登记**：节点类型、属性与编辑方式、规则、渲染、命令、面板、物料来源、设置分区、引导步骤、导入导出都经 `extensions`，同一页面多个实例互不影响；不往 `window` 挂东西、不在模块顶层产生副作用、不发网络请求。
- **样式**：Light DOM，只消费 `@xihan-ui` 的语义令牌，不写颜色、间距、圆角散值。
- **注释**只写代码做什么；设计理由写进提交说明。源码文件带仓库统一的 MIT 文件头。

## 复用 XiHan.UI

`@xihan-ui/*` 是 peerDependencies（`^5.0.0`），开发时装 catalog 里的正式包。UI 已有的组件、编码器、算法与格式化一律直接用；常用能力即使眼下只有流程用到，也先封装进 UI。只有流程专属语义（端口位置、节点类型、带业务语义的编辑操作）留在本仓。

设计器的外框、面板、菜单栏、设置对话框、引导、命令表这些零件在 XiHan.UI 的 `@xihan-ui/designer-shell` 与 `@xihan-ui/designer-kit` 里，**缺陷与新能力去 UI 仓改**，不在本仓局部修补或另写一套；UI 那边改完要等 UI 发版、本仓升 catalog 才用得上。临时验证未发布的 UI 改动用 `overrides` 指同级 `XiHan.UI/ui/packages/<分组>/<包>`，验完删掉、恢复锁文件，不提交。

## 改完要做的

1. 测试：core 在 Node 里测，runtime 与 designer 的用例文件头写 `// @vitest-environment jsdom`；改行为先写会失败的用例。
2. 门禁（在 `flow/`）：`pnpm lint`、`pnpm build`、`pnpm typecheck`、`pnpm test`；动了包的导出、`exports` 或依赖时加 `pnpm gate:publish`，必要时 `pnpm smoke --pack`；最后 `git diff --check`。
3. 使用者能感知的改动附一份变更集（`pnpm changeset`），中文、官方口径，级别照 `flow/.changeset/README.md`。
4. 改了公开 API、流程定义类型、问题码或这些注释：到 `docs/` 跑 `pnpm gen` 并随改动一起提交，正文与示例同步改（`xihan-flow-docs-site`）。
5. 一项完整功能一个提交，scope 取 `core`、`runtime`、`designer`、`docs`、`repo`。
