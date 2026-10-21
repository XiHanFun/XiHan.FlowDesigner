---
name: xihan-flow-create-pr
description: 为 XiHan.FlowDesigner 准备、审查或创建 Pull Request 时使用。适用于生成 PR 标题与正文、比较当前分支和基线、填写仓库模板或执行 gh pr create；普通代码审查不使用。
---

# XiHan.FlowDesigner 创建 PR

## 前置检查

- 读取 `git status --short --branch`；存在 rebase、merge、未解决冲突或 detached HEAD 时，不创建 PR。
- 分支名按 `AGENTS.md`「分支与 worktree」分组（`feat/`、`fix/`、`issue/<编号>`、`pr/<编号>-review`）；还是 `claude/<名>` 这类工具前缀时，推送前先改名。分支为 `issue/<编号>` 时在「关联 Issue」填该编号。
- base 通常是 `dev`；`main` 只接收发版，不无依据地改成 `main`。
- 用 `git log <base>..HEAD`、`git diff --stat <base>...HEAD` 和完整 diff 总结整条分支，不只看最后一个提交。
- 核对提交信息、变更集（`flow/.changeset/*.md`）、参考页（`docs/reference/` 是否随源码重新生成）、文档与测试是否与实际改动一致。

## PR 内容

严格使用 `.github/PULL_REQUEST_TEMPLATE.md` 的结构：关联 Issue、变更类型、变更说明、影响范围、自测清单、破坏性变更、补充说明 / 截图。

- 标题用 Conventional Commit 形态，scope 取 `core`、`runtime`、`designer`、`docs`、`repo`，准确概括使用者能感知的影响。
- 影响范围写包（core / runtime / designer）、元素与扩展点，不堆文件名。
- 自测清单只勾实际跑过的；改了 `docs/` 时补写 `pnpm gate:gen`、`pnpm check:examples`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 的结果；没跑或失败的写明原因。
- 公开面变化要有正确级别的变更集；破坏性变化写清旧写法与新写法。改了 XiHan 工作流引擎预设的，说明与引擎一致性测试的结果。

只要求草稿时只输出标题和正文，不写远程。明确要求创建 PR 时，确认分支已推送后用 `gh pr create`；可以推送当前分支，但不 force push、不合并、不改其他远端状态。创建后返回 PR 链接。
