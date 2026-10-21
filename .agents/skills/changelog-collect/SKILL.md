---
name: xihan-flow-changelog-collect
description: 收集 XiHan.FlowDesigner 两个版本或引用之间使用者能感知的变化、核对变更集或更新文档站 docs/changelog.md 时使用。它不提升版本、不消费变更集，也不发布 npm 包。
---

# XiHan.FlowDesigner 更新日志整理

## 事实源

- 用户指定的起止 tag / commit；没给终点用当前 HEAD，没给起点时先提出最近的 `v*` 标签供确认。
- `git log <from>..<to>`、实际 diff、`flow/.changeset/*.md`（预发布期间已消费的记在 `flow/.changeset/pre.json` 的 `changesets` 里）。
- 各包 `CHANGELOG.md` 与 `docs/changelog.md` 现有的分类、语气与格式。

## 收录规则

- 只收使用者能感知的变化，开头标 **新增 / 修复 / 调整 / 移除**：公开 API、元素的属性 / 事件 / 方法 / 部件、流程定义结构、扩展点、XiHan 工作流引擎预设、样式外观、语言包文案、问题码。
- CI、测试、文档站、playground、构建与发版脚本、README 不收，除非改变了发出去的产物或用法。
- 每条写使用者得到什么、要做什么，不写「改了某个函数」；包名、元素名、属性与事件用反引号。
- 同一变化跨 core、runtime、designer 时合成一条；破坏性变化写清旧写法与新写法。
- 三个包锁步同版，`docs/changelog.md` 一版一节：`## v<版本>（YYYY-MM-DD）`，按包或按领域分条。

变更集是逐笔的发布输入，`docs/changelog.md` 是版本级摘要，两者互相核对。本技能不运行 `VersionUpgrade` 或 `changeset version`，不删变更集，不改版本号；定版本见 `xihan-flow-version-release`。
