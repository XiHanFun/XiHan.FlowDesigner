---
name: xihan-flow-workflow-preset
description: 修改或核对 XiHan.FlowDesigner 的 XiHan 工作流引擎预设（@xihan-flow/core/presets/xihan-workflow）时使用。适用于 XiHan.Framework 工作流的活动类型、属性、出线方式或定义结构有变化，预设的节点、属性、规则、文案要跟上，或与引擎定义互转出了问题。
---

# XiHan.FlowDesigner 工作流引擎预设

## 契约归属

活动类型与属性的所有者是 XiHan.Framework 的工作流引擎（`XiHan.Framework.Workflow` 与 `.Abstractions`）。预设跟着引擎走：引擎改了，预设与它的一致性用例在本仓**同一笔**跟上；不在预设里另造引擎没有的活动、属性键或取值，也不用静默兜底去兼容引擎的旧写法。

## 预设的组成（`flow/packages/core/src/presets/xihan-workflow/`）

| 文件 | 内容 |
| --- | --- |
| `activities.ts` | 每种活动一个节点类型（各配一枚 `@xihan-ui/icons` 图标）；引擎属性放在 `data.properties` 下、键名与引擎一致，超时、失败续行、重试策略放在 `data` 下；按源节点类型的出线属性；流程定义级属性 |
| `rules.ts` | 与引擎发布时检查对齐的校验规则 |
| `definition.ts` | `toWorkflowDefinition` / `fromWorkflowDefinition`：流程定义与引擎定义 JSON 互转，坐标、拐点与外观经 `designerLayout`、`designerEdges`、`designerExtensions` 往返 |
| `texts.ts`、`locale/` | 文案的类型与十种语言，与 XiHan.UI 的语言一一对应 |
| `index.ts` | `createXihanWorkflow(options)` 按文案生成扩展，`xihanWorkflow` 是英文缺省，`XIHAN_WORKFLOW_ID` |

## 一致性用例

- `flow/packages/core/test/presets/xihan-workflow.test.ts`：节点类型、图标、出线属性、属性路径、文案齐全、规则与互转往返。
- `flow/packages/core/test/presets/xihan-workflow-engine.test.ts`：读同级 XiHan.Framework 检出的 C# 源码（`XIHAN_FRAMEWORK_DIR` 可另指），逐项核对活动类型与 `WorkflowActivityTypes`、每种活动读的属性键、出线流转方式、枚举选项、节点级字段与重试策略的字段名。**找不到源码时整组跳过，CI 上就是跳过的**，所以改预设或引擎后必须在本机跑，并确认这组真的执行了。

## 改动流程

1. 先读 XiHan.Framework 那边的变化（活动类、`WorkflowActivityTypes`、定义模型），确认是新增、改名还是删除。
2. 改 `activities.ts` / `rules.ts` / `definition.ts`；新增的文案键在 `texts.ts` 加类型，十种语言都补上。
3. 先让一致性用例按新引擎失败，再改到通过；在 `flow/` 跑 `pnpm --filter @xihan-flow/core test`，确认 engine 那组没有跳过。
4. `flow/` 门禁全跑；附变更集（新增活动为 `minor`，删除或改名属性键为 `major` 并写迁移）。
5. 文档：`docs/guide/xihan-workflow.md` 的节点与属性说明、`docs/examples/schemas/` 里装了预设的示例；到 `docs/` 跑 `pnpm gen`（参考页）与 `pnpm check:examples`（它会把装了预设的示例换成引擎定义再读回，核对不变）。
