来源：https://flow.docs.xihanfun.com/ai/agents

# For Agents

在项目里接入曦寒流程设计器时，怎样让 Claude Code、Cursor、Codex、GitHub Copilot 这类 AI 编程工具写出符合约定的代码。

流程设计器没有单独的命令行或 MCP 服务端。AI 工具需要的资料分三处：本站的[机读文档](./llms)、流程用到的 [XiHan.UI](https://ui.docs.xihanfun.com/ai/agents) 的 MCP 服务端，以及改流程仓库本身时读的仓库根 `AGENTS.md`。

## 复制这段提示词

把下面这段放进对话，或补进你项目的 `AGENTS.md`：

```text
这个项目用曦寒流程设计器（@xihan-flow/core、@xihan-flow/runtime、@xihan-flow/designer），以原生 Web Components 交付。
API 以项目里装的版本为准，不要凭记忆写：先读 https://flow.docs.xihanfun.com/llms.txt，按需读其中列出的页面（站点地址后加 .md 取 Markdown）。
- 流程定义是纯 JSON，属性叫 schema，变化事件叫 schema-change；节点类型、属性、规则、命令、面板都经 extensions 登记，不改设计器源码。
- 查看器用 defineFlowViewer() 注册，设计器用 defineFlowDesigner() 注册；样式引 @xihan-ui/styles，设计器另引 @xihan-ui/designer-shell/style.css 与 @xihan-flow/designer/style.css。
- 对接 XiHan.Framework 工作流引擎时装 @xihan-flow/core/presets/xihan-workflow 预设，用 toWorkflowDefinition / fromWorkflowDefinition 与引擎定义互转。
- 保存、权限与取数归宿主：设计器不发网络请求；保存前看 validate()，服务端用 validateDocument 复核。
用到 XiHan.UI 的组件、令牌与语言包时，读 https://ui.docs.xihanfun.com/llms.txt，或接入 XiHan.UI 的 MCP 服务端。
```

## 要装的包

| 包 | 什么时候装 |
| --- | --- |
| `@xihan-flow/core` | 都要：流程定义的类型、读入、校验与编辑操作，以及 XiHan 工作流引擎预设 |
| `@xihan-flow/runtime` | 显示流程、标出运行状态：`<xh-flow-viewer>` |
| `@xihan-flow/designer` | 编辑流程：`<xh-flow-designer>` |
| `@xihan-ui/styles` | 设计令牌与组件皮肤，查看器与设计器的样式都取自它 |
| `@xihan-ui/designer-shell` | 用设计器时引它的样式表 |

流程各包用到的 `@xihan-ui/*` 写在 peerDependencies 里，pnpm 与 npm 7 起会自动装上；项目里自己也用 XiHan.UI 时，流程与项目共用同一份。安装命令与第一个示例见[快速开始](../quickstart)。

## 关键约定

- **模板即数据**：流程定义是纯 JSON，不含也不执行代码；导入别人给的定义不会注入脚本。从存储或接口取回的定义先交给 `readDocument` 检查字段，见[流程定义结构](../guide/schema)。
- **经扩展登记，不改源码**：节点类型、属性与编辑方式、校验规则、节点渲染、命令、面板、物料来源、设置分区、引导步骤与导入导出，都写进 `extensions`，见[扩展](../guide/extensions)。
- **数据由宿主提供**：查看器与设计器不发网络请求；模板的保存、权限、受理人这类业务数据与服务端复核都归宿主，见[与宿主集成](../guide/host)。
- **样式只取令牌**：元素用 Light DOM，颜色、间距、圆角都取 XiHan.UI 的设计令牌，宿主换主题或主题色，流程跟着变。
- **文案按语言包合并**：流程的语言包（如 `flowZhCN`）与 XiHan.UI 同一语言的语言包合并后全局设置，见[快速开始](../quickstart)。
- **工作流引擎预设**：`@xihan-flow/core/presets/xihan-workflow` 把 XiHan.Framework 工作流引擎的每种活动做成一个节点类型，属性键与引擎读的一致，规则与引擎发布时的检查对齐，见 [XiHan 工作流引擎预设](../guide/xihan-workflow)。

## 改流程仓库本身

给 XiHan.FlowDesigner 提交代码时，仓库根的 `AGENTS.md` 写明了目录结构、常用命令、分层与依赖、硬性约定、发版与提交规范；`CLAUDE.md` 链接到它，Claude Code 与 Codex 打开仓库即可读到。Cursor、GitHub Copilot 等工具可以在各自的规则文件里写一句「先读仓库根的 AGENTS.md」。

## 相关

- [LLMs.txt](./llms) · [快速开始](../quickstart) · [扩展](../guide/extensions) · [与宿主集成](../guide/host)
- [XiHan.UI 的 AI 辅助开发](https://ui.docs.xihanfun.com/ai/agents) · [XiHan.Framework 的 AI 辅助开发](https://framework.docs.xihanfun.com/ai/agents)
