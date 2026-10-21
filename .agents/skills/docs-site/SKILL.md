---
name: xihan-flow-docs-site
description: 修改 XiHan.FlowDesigner 文档站（docs/，VitePress + @xihanfun/vitepress-theme）时使用。适用于写正文与示例、重新生成参考页、导航与侧栏、更新日志页、机读资产 llms.txt，以及跑文档站门禁；产品源码的改动用 xihan-flow-designer-development。
---

# XiHan.FlowDesigner 文档站

`docs/` 是独立的 pnpm 项目，站点地址 https://flow.docs.xihanfun.com。流程三个包经 `link:` 读 `flow/packages/*` 的产物，先在 `flow/` 构建；`@xihan-ui/*` 装 npm 正式包。

## 命令（在 `docs/`）

| 任务 | 命令 |
| --- | --- |
| 开发（端口 5188） | `pnpm dev` |
| 重新生成参考页 / 只比对 | `pnpm gen` / `pnpm gate:gen` |
| 示例读入、校验并核对正文引用 | `pnpm check:examples` |
| 示例类型检查 | `pnpm typecheck` |
| Lint / 构建（站内死链让构建失败） | `pnpm lint` / `pnpm build` |

## 规矩

- **参考页是生成的**：`docs/reference/` 由 `scripts/gen-reference.mjs` 从源码注释、`DEFAULT_ISSUE_SEVERITY`、`flowZhCN` 的问题说明与已装的 `@xihan-ui` 类型声明生成，不手改；说明不对就改源码注释再 `pnpm gen`，随改动一起提交。
- **示例都是真代码**：TypeScript 示例放 `examples/`，正文用 `<<< @/examples/…#片段` 引入。`schemas/` 导出 `schema` 与 `extensions`，由 `check:examples` 读入校验，装了 XiHan 工作流引擎预设的还换成引擎定义再读回核对；`demos/` 导出 `mount(host)`，页面上写 `<FlowDemo name="…" />` 真实运行；`snippets/` 只做类型检查。
- 正文里含 `{{` 的行内代码写成 `<code v-pre>…</code>`，否则被 Vue 当成插值吃掉，构建也不报错。
- **只有一份 UI**：站点装流程各包的全部 `@xihan-ui/*` peer，`.vitepress/config.ts` 用 `resolve.dedupe` 让 `link:` 进来的流程包也从站点根目录解析；流程包加了 peer 而站点没装，加载配置时直接报错。两份 UI 时设计器的语言配置落不到它身上，界面会变英文。
- **导航与侧栏**在 `.vitepress/config.ts`：「指南」下拉是开始 / 深入 / AI 辅助开发，侧栏是开始 / 指南 / AI 辅助开发；「生态」与门户 XiHan.Docs 一致（官方生态三项、设计器四项）；版本下拉的版本号取 core 的 `version`，下面是更新日志与 npm。不复制或改写主题已提供的样式。
- **机读资产**由主题的 `llms` 配置在构建时产出：`llms.txt`、`llms-full.txt`、`llms-guide.txt`、`llms-reference.txt` 与每页的 `.md`；新加一个目录的页面，要在 `llms.sections` 里登记。
- **更新日志**：每次发版在 `changelog.md` 补一节 `## v<版本>（YYYY-MM-DD）`，只收使用者能感知的变化。
- **写法**：只写已经做完的能力；不写节点类型数、包数与依赖的具体版本号，不写预发布阶段的铺垫；跨站链接用完整的生产地址。
- **站点契约**：`public/CNAME`、`public/.nojekyll`、`.github/workflows/deploy-docs.yml` 不因清理而删；`llms.site` 与 `package.json` 的 `homepage` 写同一个地址。部署只在 Release 发完包后进行。

## 改完要做的

`pnpm gate:gen`、`pnpm check:examples`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 全过，`git diff --check`。改了导航、示例或样式时 `pnpm dev` 打开相关页面看一眼，控制台没有报错；改了机读资产的确认 `.vitepress/dist/llms.txt` 里有对应的一节。提交 scope 用 `docs`。
