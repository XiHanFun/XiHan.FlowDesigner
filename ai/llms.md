来源：https://flow.docs.xihanfun.com/ai/llms

# LLMs.txt

文档站在构建时产出一组给大语言模型读的机读资产，内容与站点正文同源。AI 工具读取它们即可了解流程设计器的用法、扩展点与 API。

## 可用资源

| 文件 | 说明 |
| --- | --- |
| [llms.txt](https://flow.docs.xihanfun.com/llms.txt) | 索引：全部页面的标题、一句话摘要与地址，以及下列资产的入口 |
| [llms-full.txt](https://flow.docs.xihanfun.com/llms-full.txt) | 全站正文 |
| [llms-guide.txt](https://flow.docs.xihanfun.com/llms-guide.txt) | 指南：流程定义结构、查看器、设计器、扩展、XiHan 工作流引擎预设与宿主集成 |
| [llms-reference.txt](https://flow.docs.xihanfun.com/llms-reference.txt) | 参考：流程定义类型、问题码与各包的 API |

**单页 Markdown**：任何一页的站点地址后加 `.md` 即可取到这一页的 Markdown，如 [quickstart.md](https://flow.docs.xihanfun.com/quickstart.md)、[guide/designer.md](https://flow.docs.xihanfun.com/guide/designer.md)。每页正文上方的「取本页 Markdown」也指向它。机读正文里，示例代码已经展开成代码块。

流程的元素、样式与语言包建立在 XiHan.UI 之上，对接的工作流引擎在 XiHan.Framework 里，两者各有一套机读资产：

| 站点 | 索引 |
| --- | --- |
| 视图组件 | [ui.docs.xihanfun.com/llms.txt](https://ui.docs.xihanfun.com/llms.txt) |
| 开发框架 | [framework.docs.xihanfun.com/llms.txt](https://framework.docs.xihanfun.com/llms.txt) |

## 在 AI 工具中使用

所有工具都可以用同一段提示词：

```text
阅读 https://flow.docs.xihanfun.com/llms.txt 了解曦寒流程设计器；用到 XiHan.UI 的组件、令牌与语言包时再读 https://ui.docs.xihanfun.com/llms.txt，对接工作流引擎时再读 https://framework.docs.xihanfun.com/llms.txt。按需读取其中列出的页面（站点地址后加 .md 取 Markdown），以文档和项目里装的版本为准。
```

| 工具 | 做法 |
| --- | --- |
| Claude Code | 写进项目的 `CLAUDE.md`，或用 `/memory` 记下 |
| Cursor | 在对话中用 `@Docs` 添加上面的索引，或写进 `.cursor/rules` |
| Codex | 写进项目的 `AGENTS.md` |
| GitHub Copilot | 写进 `.github/copilot-instructions.md` |

## 相关

- [For Agents](./agents)
