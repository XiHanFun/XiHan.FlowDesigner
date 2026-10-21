---
name: xihan-flow-commit-msg
description: 根据 XiHan.FlowDesigner 当前暂存区生成提交信息时使用。适用于“提交信息”“commit msg”“msg”或提交前概括 staged changes；只生成消息，不负责暂存、解决冲突或执行提交。
---

# XiHan.FlowDesigner 提交信息

## 工作流

1. 运行 `git status --short --branch`，存在未解决冲突时停止并指出冲突，不生成假定已完成的提交信息。
2. 只读取 `git diff --cached --stat`、`git diff --cached` 和最近 20 条提交；未暂存内容不纳入，除非用户明确要求。
3. 暂存区为空时直接说明，不根据工作区或聊天内容猜消息。
4. 把全部暂存改动归纳为一个意图，写一行 Conventional Commit 标题；用户要正文时，正文写改了什么、为什么，以及跑过哪些门禁。

## 格式

`<type>(<scope>): <中文说明>`，type 取 `feat`、`fix`、`refactor`、`perf`、`docs`、`style`、`test`、`build`、`ci`、`chore`、`revert`。

- scope 取 `core`、`runtime`、`designer`、`docs`、`repo`，跨几层时组合，如 `feat(designer,docs)`；不逐文件罗列。
- 发版那一笔固定写 `build: v<版本>`；只改依赖、锁文件与工作区配置的写 `build(repo)`。
- 删除或改名公开 API、元素的属性 / 事件 / 方法 / 部件、流程定义结构或扩展点时用 `!`，并确认带了 major 变更集。
- 标题与正文每行不超过 100 个字符；说明以中文开头，写使用者能感知的结果，不写「改了某文件」。

只要求消息时，最终只输出提交标题（要正文时再附正文），不附解释、代码块或候选列表。
