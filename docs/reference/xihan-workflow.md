# XiHan 工作流引擎预设

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`@xihan-flow/core/presets/xihan-workflow` 是 XiHan.Framework 工作流引擎的节点预设：引擎的每种活动对应一个节点类型，属性键与引擎读的一致，并能与引擎定义 JSON 互转。用法见 [XiHan 工作流引擎预设](../guide/xihan-workflow)。

## 节点类型

下表与各节点类型的属性取自中文文案的预设（`createXihanWorkflow({ texts: xihanWorkflowZhCN })`）。类型名就是引擎的活动类型。

| 类型 | 名称 | 类别 | 图标 | 端口 | 个数与可达性 |
| --- | --- | --- | --- | --- | --- |
| [`Start`](#start) | 开始 | 流程控制 | `PlayIcon` | 右侧出口 | 可达性的起点，不要求入线；恰好 1 个 |
| [`End`](#end) | 结束 | 流程控制 | `CircleCheckIcon` | 左侧入口 | 不要求出线 |
| [`Decision`](#decision) | 条件分支 | 流程控制 | `GitBranchIcon` | 左侧入口、右侧出口 | — |
| [`Parallel`](#parallel) | 并行分支 | 流程控制 | `LayersIcon` | 左侧入口、右侧出口 | — |
| [`Join`](#join) | 汇聚 | 流程控制 | `ListChecksIcon` | 左侧入口、右侧出口 | — |
| [`Delay`](#delay) | 延时 | 流程控制 | `TimerIcon` | 左侧入口、右侧出口 | — |
| [`SubWorkflow`](#subworkflow) | 子流程 | 流程控制 | `PuzzleIcon` | 左侧入口、右侧出口 | — |
| [`ForEach`](#foreach) | 遍历 | 流程控制 | `RefreshIcon` | 左侧入口、右侧出口 | — |
| [`Terminate`](#terminate) | 终止 | 流程控制 | `BanIcon` | 左侧入口 | 不要求出线 |
| [`Fault`](#fault) | 抛出故障 | 流程控制 | `TriangleAlertIcon` | 左侧入口 | 不要求出线 |
| [`UserTask`](#usertask) | 人工任务 | 人工 | `UserCheckIcon` | 左侧入口、右侧出口 | — |
| [`SetVariable`](#setvariable) | 设置变量 | 数据 | `PencilIcon` | 左侧入口、右侧出口 | — |
| [`Http`](#http) | HTTP 请求 | 集成 | `GlobeIcon` | 左侧入口、右侧出口 | — |
| [`Script`](#script) | 脚本 | 集成 | `CpuIcon` | 左侧入口、右侧出口 | — |
| [`PublishEvent`](#publishevent) | 发布事件 | 事件 | `MegaphoneIcon` | 左侧入口、右侧出口 | — |
| [`WaitSignal`](#waitsignal) | 等待信号 | 事件 | `BellIcon` | 左侧入口、右侧出口 | — |
| [`Log`](#log) | 日志 | 工具 | `FileTextIcon` | 左侧入口、右侧出口 | — |

### Start · 开始 {#start}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### End · 结束 {#end}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 流程结果 | `data.properties.Outcome` | `select`：通过（`approved`）、驳回（`rejected`） | 基本 | — |

### Decision · 条件分支 {#decision}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |
| 优先级 | `data.priority` | `number` | — | — |
| 默认分支 | `data.isDefault` | `boolean` | — | — |

### Parallel · 并行分支 {#parallel}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |

从它连出的连线没有额外属性。

### Join · 汇聚 {#join}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 汇聚方式 | `data.properties.Mode` | `select`：等待全部（`WaitAll`）、任一到达（`WaitAny`） | 基本 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### Delay · 延时 {#delay}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 时长（秒） | `data.properties.DurationSeconds` | `text` | 基本 | 是 |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### SubWorkflow · 子流程 {#subworkflow}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 流程编码 | `data.properties.DefinitionCode` | `text` | 基本 | 是 |
| 流程版本 | `data.properties.DefinitionVersion` | `number` | 基本 | — |
| 变量 | `data.properties.Variables` | `json` | 基本 | — |
| 变量表达式 | `data.properties.VariableExpressions` | `json` | 基本 | — |
| 等待完成 | `data.properties.WaitForCompletion` | `boolean` | 基本 | — |
| 结果变量 | `data.properties.ResultVariable` | `text` | 基本 | — |
| 子流程故障时失败 | `data.properties.FailOnChildFault` | `boolean` | 基本 | — |
| 超时（秒） | `data.timeoutSeconds` | `number` | 执行 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### ForEach · 遍历 {#foreach}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 集合表达式 | `data.properties.ItemsExpression` | `text` | 基本 | — |
| 元素变量名 | `data.properties.ItemVariableName` | `text` | 基本 | — |
| 流程编码 | `data.properties.DefinitionCode` | `text` | 基本 | 是 |
| 流程版本 | `data.properties.DefinitionVersion` | `number` | 基本 | — |
| 并行执行 | `data.properties.Parallel` | `boolean` | 基本 | — |
| 一项失败即停止 | `data.properties.FailFast` | `boolean` | 基本 | — |
| 变量 | `data.properties.Variables` | `json` | 基本 | — |
| 结果变量 | `data.properties.ResultVariable` | `text` | 基本 | — |
| 超时（秒） | `data.timeoutSeconds` | `number` | 执行 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### Terminate · 终止 {#terminate}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 终止原因 | `data.properties.Reason` | `text` | 基本 | — |

### Fault · 抛出故障 {#fault}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 内容 | `data.properties.Message` | `text` | 基本 | — |

### UserTask · 人工任务 {#usertask}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 待办标题 | `data.properties.Title` | `text` | 基本 | — |
| 受理人规则 | `data.properties.AssigneeRules` | `xihan-workflow.assignee-rules` | 参与人 | — |
| 受理人 | `data.properties.Assignees` | `tags` | 参与人 | — |
| 受理人表达式 | `data.properties.AssigneesExpression` | `text` | 参与人 | — |
| 排除发起人 | `data.properties.ExcludeStarter` | `boolean` | 参与人 | — |
| 通过规则 | `data.properties.CompletionPolicy` | `select`：任一人通过（`Any`）、全部通过（`All`）、依次审批（`Sequential`） | 参与人 | — |
| 没有受理人时 | `data.properties.EmptyAssigneeStrategy` | `select`：报错（`Fault`）、自动通过（`AutoApprove`）、自动驳回（`AutoReject`）、转交兜底受理人（`Fallback`） | 参与人 | — |
| 兜底受理人规则 | `data.properties.FallbackAssigneeRules` | `xihan-workflow.assignee-rules` | 参与人 | 是 |
| 抄送规则 | `data.properties.CcRules` | `xihan-workflow.assignee-rules` | 参与人 | — |
| 抄送人 | `data.properties.CcUserIds` | `tags` | 参与人 | — |
| 表单数据 | `data.properties.FormData` | `json` | 表单 | — |
| 可选办理结果 | `data.properties.AllowedOutcomes` | `tags` | 表单 | — |
| 超时（秒） | `data.timeoutSeconds` | `number` | 执行 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### SetVariable · 设置变量 {#setvariable}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 固定值 | `data.properties.Values` | `json` | 基本 | — |
| 表达式 | `data.properties.Expressions` | `json` | 基本 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### Http · HTTP 请求 {#http}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 地址 | `data.properties.Url` | `text` | 基本 | 是 |
| 请求方法 | `data.properties.Method` | `select`：GET（`GET`）、POST（`POST`）、PUT（`PUT`）、DELETE（`DELETE`）、PATCH（`PATCH`） | 基本 | — |
| 请求头 | `data.properties.Headers` | `json` | 基本 | — |
| 请求体 | `data.properties.Body` | `text` | 基本 | — |
| 内容类型 | `data.properties.ContentType` | `text` | 基本 | — |
| 请求超时（秒） | `data.properties.TimeoutSeconds` | `number` | 基本 | — |
| 结果变量 | `data.properties.ResultVariable` | `text` | 基本 | — |
| 错误状态码时失败 | `data.properties.FailOnErrorStatus` | `boolean` | 基本 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### Script · 脚本 {#script}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 代码 | `data.properties.Code` | `text` | 基本 | 是 |
| 结果变量 | `data.properties.ResultVariable` | `text` | 基本 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### PublishEvent · 发布事件 {#publishevent}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 事件名 | `data.properties.EventName` | `text` | 基本 | 是 |
| 事件数据 | `data.properties.Payload` | `json` | 基本 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### WaitSignal · 等待信号 {#waitsignal}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 信号名 | `data.properties.SignalName` | `text` | 基本 | 是 |
| 接受任意关联 | `data.properties.AcceptAnyCorrelation` | `boolean` | 基本 | — |
| 超时（秒） | `data.timeoutSeconds` | `number` | 执行 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

### Log · 日志 {#log}

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 名称 | `label` | `text` | 基本 | — |
| 内容 | `data.properties.Message` | `text` | 基本 | — |
| 级别 | `data.properties.Level` | `select`：调试（`Debug`）、信息（`Information`）、警告（`Warning`）、错误（`Error`） | 基本 | — |
| 失败后继续 | `data.continueOnError` | `boolean` | 执行 | — |
| 最多尝试次数 | `data.retryPolicy.maxAttempts` | `number` | 执行 | — |
| 首次重试等待（秒） | `data.retryPolicy.firstDelaySeconds` | `number` | 执行 | — |
| 退避倍率 | `data.retryPolicy.backoffFactor` | `number` | 执行 | — |

从它连出的连线：

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 条件 | `data.condition` | `text` | — | — |

## 流程定义级属性

什么都没选中时属性面板编辑这些属性，换成引擎定义时写在定义的顶层。

| 属性 | 路径 | 编辑方式 | 分组 | 必填 |
| --- | --- | --- | --- | --- |
| 流程编码 | `data.code` | `text` | 基本 | 是 |
| 名称 | `data.name` | `text` | 基本 | 是 |
| 分类 | `data.category` | `text` | 基本 | — |
| 描述 | `data.description` | `text` | 基本 | — |
| 启用补偿 | `data.enableCompensation` | `boolean` | 执行 | — |
| 启动变量 | `data.variables` | `json` | 基本 | — |

## 规则

规则检查引擎发布定义时把关、通用校验覆盖不到的约束。说明取自中文文案，严重程度可以经 `validateOptions.severity` 改写。

| 问题码 | 严重程度 | 说明 |
| --- | --- | --- |
| `xihan-workflow.no-end` | 警告 | 流程没有结束或终止节点 |
| `xihan-workflow.decision-multiple-defaults` | 错误 | 条件分支至多一条默认分支 |
| `xihan-workflow.decision-no-default` | 警告 | 加一条默认分支或无条件分支 |
| `xihan-workflow.user-task-no-assignee` | 错误 | 配置受理人规则、受理人或受理人表达式 |

## 预设

### createXihanWorkflow() {#createxihanworkflow}

```ts
declare function createXihanWorkflow(options?: CreateXihanWorkflowOptions): FlowCoreExtension
```

按文案生成预设扩展。节点类型与属性的文字写在扩展里，换语言就换一个扩展对象（同一个 id，按卸下再装上处理）；物料分类与属性分组的文字交给设计器的 paletteGroupLabels、propertyGroupLabels。受理人规则的编辑方式是 XIHAN_WORKFLOW_ASSIGNEE_RULES，编辑器由宿主经设计器扩展的 editors.byControl 提供。

### CreateXihanWorkflowOptions {#createxihanworkflowoptions}

createXihanWorkflow 的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `texts?` | `XihanWorkflowTextsOverride` | 文案，各部分按键覆盖英文缺省；中文直接传 xihanWorkflowZhCN。 |
| `legacyAssignees?` | `boolean` | 审批节点的属性面板里显示旧的受理人写法（Assignees、AssigneesExpression、CcUserIds），缺省 true。为 false 时不登记这三项属性，已有的值照旧读写、往返不丢，只是属性面板里不再显示。 |

### XihanWorkflowTexts {#xihanworkflowtexts}

预设的全部文案。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `activities` | `Readonly<Record<XihanWorkflowActivityType, string>>` | 节点类型的显示名，键是活动类型。 |
| `categories` | `Readonly<Record<XihanWorkflowCategory, string>>` | 交给设计器的 paletteGroupLabels。 |
| `groups` | `Readonly<Record<XihanWorkflowGroup, string>>` | 交给设计器的 propertyGroupLabels。 |
| `properties` | `Readonly<Record<XihanWorkflowPropertyKey, string>>` | 属性的标签。 |
| `options` | `Readonly<Record<XihanWorkflowOptionKey, string>>` | 下拉选项的文字。 |
| `issues` | `Readonly<Record<XihanWorkflowIssueCode, string>>` | 规则问题的说明。 |

## 与引擎定义互转

### toWorkflowDefinition() {#toworkflowdefinition}

```ts
declare function toWorkflowDefinition(document: FlowDocument): XihanWorkflowDefinition
```

流程文档换成引擎定义：文档 data 里的字段放在前面，接着 nodes、transitions 与 extraProperties。节点坐标写进 extraProperties.designerLayout；有拐点或外观的连线写进 designerEdges，有扩展数据的写进 designerExtensions。节点总有 name 与 properties（引擎的缺省分别是空串与空字典）。

### fromWorkflowDefinition() {#fromworkflowdefinition}

```ts
declare function fromWorkflowDefinition(definition: XihanWorkflowDefinition, options?: FromWorkflowDefinitionOptions): FlowDocument
```

引擎定义换成流程文档。节点坐标取 extraProperties.designerLayout，有节点没有坐标时按连线自左向右分层排出它的坐标；尺寸按活动类型取。连线没有 id 时按「源-&gt;目标#序号」补上。Delay 的 DurationSeconds 为数字时换成字符串，其余字段原样搬，值为 null 的字段去掉。结构不对时抛 TypeError。

### FromWorkflowDefinitionOptions {#fromworkflowdefinitionoptions}

fromWorkflowDefinition 的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodeTypes?` | `FlowNodeTypeRegistry` | 节点尺寸先从这里按活动类型取，取不到再用预设的尺寸。 |

### XihanWorkflowDefinition {#xihanworkflowdefinition}

引擎的流程定义；没列出的字段原样保留。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id?` | `string` |  |
| `code?` | `string` | 流程编码；同一编码可以有多个版本。 |
| `name?` | `string` |  |
| `version?` | `number` | 版本号，同一编码内从 1 开始递增。 |
| `description?` | `string \| null` |  |
| `category?` | `string \| null` |  |
| `status?` | `string` | 状态，如 Draft、Published。 |
| `enableCompensation?` | `boolean` | 启用补偿：实例被取消时按执行的逆序执行可补偿活动的补偿逻辑。 |
| `nodes?` | `readonly XihanWorkflowNode[]` |  |
| `transitions?` | `readonly XihanWorkflowTransition[]` |  |
| `variables?` | `readonly JsonObject[]` | 启动变量的声明。 |
| `tenantId?` | `number \| null` | 租户 id；为空是平台级定义。 |
| `creationTime?` | `string` |  |
| `publishTime?` | `string \| null` |  |
| `extraProperties?` | `Readonly<Record<string, string>>` | 扩展属性，值都是字符串。 |

### XihanWorkflowNode {#xihanworkflownode}

引擎定义里的节点。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 节点 id，流程定义内唯一。 |
| `name?` | `string` | 节点名称，即节点的 label。 |
| `activityType` | `string` | 活动类型，即节点的 type；引擎内置的见 XIHAN_WORKFLOW_ACTIVITY_TYPES，也可以是应用登记的活动。 |
| `properties?` | `JsonObject` | 活动属性，键名由各活动约定。 |
| `retryPolicy?` | `{ readonly maxAttempts?: number, readonly firstDelaySeconds?: number, readonly backoffFactor?: number } \| null` | 重试策略；为空不重试。 |
| `timeoutSeconds?` | `number \| null` | 挂起超时的秒数，只对会挂起的节点生效；为空不超时。 |
| `continueOnError?` | `boolean` | 失败续行：节点最终失败时不让整个实例故障，以 error 结果继续流转。 |

### XihanWorkflowTransition {#xihanworkflowtransition}

引擎定义里的连线。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id?` | `string` | 连线 id，流程定义内唯一。 |
| `name?` | `string \| null` | 连线名称，即连线的 label。 |
| `sourceNodeId` | `string` | 源节点 id。 |
| `targetNodeId` | `string` | 目标节点 id。 |
| `condition?` | `string \| null` | 转移条件表达式；为空表示无条件。 |
| `priority?` | `number` | 优先级：条件分支按数值从小到大逐条求值，取第一条满足的。 |
| `isDefault?` | `boolean` | 默认分支：条件分支的条件都不满足时走它。 |

## 全部导出

### activities

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `XIHAN_WORKFLOW_ASSIGNEE_RULES` | 常量 | 受理人规则的编辑方式：值是 { type, values } 的数组，编辑器由宿主提供（按 control.kind 登记）。 |
| `xihanWorkflowNodeSize` | 函数 | 节点在画布上的尺寸：开始与结束类小一些，其余（含宿主自定义的活动）一样大。 |
| `xihanWorkflowPropertyKeys` | 函数 | 各活动类型在 data.properties 下读的键，供一致性核对。 |

### definition

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `fromWorkflowDefinition` | 函数 | 引擎定义换成流程文档。 |
| `FromWorkflowDefinitionOptions` | 接口 | fromWorkflowDefinition 的选项。 |
| `toWorkflowDefinition` | 函数 | 流程文档换成引擎定义：文档 data 里的字段放在前面，接着 nodes、transitions 与 extraProperties。 |
| `XihanWorkflowDefinition` | 接口 | 引擎的流程定义；没列出的字段原样保留。 |
| `XihanWorkflowNode` | 接口 | 引擎定义里的节点。 |
| `XihanWorkflowTransition` | 接口 | 引擎定义里的连线。 |

### index

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createXihanWorkflow` | 函数 | 按文案生成预设扩展。 |
| `CreateXihanWorkflowOptions` | 接口 | createXihanWorkflow 的选项。 |
| `XIHAN_WORKFLOW_ID` | 常量 | 预设的扩展 id；规则的问题码以 xihan-workflow. 开头。 |
| `xihanWorkflow` | 常量 | 英文文案的预设扩展。 |

### texts

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `XIHAN_WORKFLOW_ACTIVITY_TYPES` | 常量 | 引擎内置的活动类型，与 XiHan.Framework.Workflow 的 WorkflowActivityTypes 一一对应。 |
| `XIHAN_WORKFLOW_TEXTS` | 常量 | 英文缺省文案。 |
| `XihanWorkflowActivityType` | 类型 | 引擎内置的活动类型名。 |
| `XihanWorkflowCategory` | 类型 | 物料面板的分类，节点类型的 category 取这些值。 |
| `XihanWorkflowGroup` | 类型 | 属性面板的分组，属性描述的 group 取这些值。 |
| `XihanWorkflowIssueCode` | 类型 | 预设规则的问题码。 |
| `XihanWorkflowOptionKey` | 类型 | 下拉选项的键：属性键加点加取值，只列需要翻译的。 |
| `XihanWorkflowPropertyKey` | 类型 | 属性名的键：节点属性用引擎的键名（Title、Url…），节点级字段与连线、流程定义的字段用 JSON 里的字段名，名称（节点名与连线名）为 name。 |
| `XihanWorkflowTexts` | 接口 | 预设的全部文案。 |
| `XihanWorkflowTextsOverride` | 类型 | 覆盖部分文案：各部分分别按键覆盖英文缺省。 |
| `xihanWorkflowZhCN` | 常量 | 中文文案。 |
