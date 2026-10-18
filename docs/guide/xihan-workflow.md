# XiHan 工作流引擎预设

XiHan.Framework 的[工作流引擎](https://framework.docs.xihanfun.com/guide/workflow)按流程定义 JSON 运行流程。`@xihan-flow/core/presets/xihan-workflow` 把引擎的每种活动做成一个节点类型，属性键与引擎读的一致，规则与引擎发布时的检查对齐，并能与引擎定义互转：设计器里画好的流程换成引擎定义交给后端保存、发布，引擎里的定义也能读回设计器。全部节点类型、属性与问题码见[预设参考](../reference/xihan-workflow)。

## 装上预设

`createXihanWorkflow` 按文案生成一个 core 层扩展，交给查看器、设计器与 `validateDocument` 都可以。中文直接传 `xihanWorkflowZhCN`；不传是英文，也可以导入现成的英文扩展 `xihanWorkflow`。17 种节点类型各配了一枚 `@xihan-ui/icons` 的图标，画布上的节点与物料条目都画在文字前面，对应关系见[参考页](../reference/xihan-workflow)。

<<< @/examples/schemas/approval.ts#extensions

- 节点类型与属性的文字写在扩展里。切换语言就换一个扩展对象，id 相同，设计器按卸下再装上处理，流程定义不变。
- 物料的类别与属性的分组只给出键，文字在文案的 `categories` 与 `groups` 里，交给设计器的 `paletteGroupLabels` 与 `propertyGroupLabels`，写法见[设计器](./designer#放上页面)。
- 节点的类型名就是引擎的活动类型，如 `Start`、`UserTask`、`Http`。

## 节点与属性

节点的属性按引擎的字段存放：活动属性写在 `data.properties` 下，键名与引擎活动读的一样，如人工任务的 `Assignees`、HTTP 请求的 `Url`；超时、失败续行与重试策略是节点级字段，写在 `data.timeoutSeconds`、`data.continueOnError` 与 `data.retryPolicy`。节点名称就是节点的标签。

属性面板按基本、参与人、表单与执行分组。必填的属性没填、取值超出范围或不在选项里时，校验照常报问题。

连线的属性随源节点类型：从条件分支连出的连线有条件、优先级与默认分支，并行分支沿全部出线流转，连出的连线没有条件。默认分支画成虚线：外观由 `isDefault` 推出，勾选、取消时跟着变，不另存一份样式。流程编码、名称、分类、描述、是否启用补偿与启动变量是流程定义级的属性，写在流程定义的 `data` 里，什么都没选中时属性面板编辑它们。

## 受理人规则

人工任务的受理人规则、兜底受理人规则与抄送规则用预设登记的编辑方式 `XIHAN_WORKFLOW_ASSIGNEE_RULES`，取值是 `{ type, values }` 的数组，与引擎的[受理人规则](https://framework.docs.xihanfun.com/guide/workflow#受理人规则)一致：引擎内置 `User`、`Starter`、`Expression` 三种，角色、部门等由应用注册。预设检查取值的形状，并要求 `User` 至少有一个受理人、`Expression` 恰好一条非空的表达式；应用注册的类型只检查形状。

选人、选角色要查宿主自己的数据，所以这种编辑方式的编辑器由宿主在设计器层的扩展里按种类提供；没有提供时，属性面板里这一行只读。下面是一个最简单的写法，把规则写成 JSON：

<<< @/examples/snippets/assignee-rules.ts#editor

人工任务还保留着旧的受理人写法：直接列受理人（`Assignees`）、受理人表达式（`AssigneesExpression`）与抄送人（`CcUserIds`）。只用受理人规则的应用写 `createXihanWorkflow({ legacyAssignees: false })`，属性面板里就不再显示这三项；定义里已有的值照旧读入、写回，往返不丢，校验也照旧认它们。缺省是 `true`，三项都显示。

把 `assigneeRules` 与预设一起放进设计器的 `extensions` 即可。编辑器的写法见[扩展](./extensions#属性编辑器)。

## 规则

预设带着几条规则，检查引擎发布定义时会拒绝、而通用校验覆盖不到的情况：

- 流程里没有结束或终止节点，报警告。
- 条件分支有不止一条默认分支，报错误；有带条件的出线、却既没有默认分支也没有无条件的出线，报警告。
- 人工任务没有配置受理人规则、受理人或受理人表达式之一，报错误。

问题码以 `xihan-workflow.` 开头，说明在预设的文案里，严重程度可以经设计器的 `validateOptions` 改写。

## 与引擎定义互转

`toWorkflowDefinition` 把流程定义换成引擎的定义 JSON，`fromWorkflowDefinition` 反过来。下面把费用审批换成引擎定义，再读回查看器；去掉坐标读回时，节点按连线自左向右重新排开：

<FlowDemo name="xihan-workflow" />

<<< @/examples/demos/xihan-workflow.ts#to

<<< @/examples/demos/xihan-workflow.ts#from

字段这样对应：

| 流程定义 | 引擎定义 |
| --- | --- |
| 节点的 `type` | 节点的 `activityType` |
| 节点的 `label` | 节点的 `name` |
| 节点 `data` 里的字段（`properties`、`retryPolicy`、`timeoutSeconds`、`continueOnError` 等） | 节点上的同名字段 |
| 连线的 `source.node`、`target.node` | 连线的 `sourceNodeId`、`targetNodeId` |
| 连线的 `label` | 连线的 `name` |
| 连线 `data` 里的字段（`condition`、`priority`、`isDefault` 等） | 连线上的同名字段 |
| 流程定义 `data` 里的字段（`code`、`name`、`category` 等） | 定义顶层的同名字段 |
| 节点坐标 | `extraProperties.designerLayout` |
| 连线的拐点与连线自己写的外观（由 `isDefault` 推出的虚线不写） | `extraProperties.designerEdges` |
| 节点、连线与流程定义上的扩展数据 | `extraProperties.designerExtensions` |

- `extraProperties` 里这三项是 JSON 字符串，引擎不读，原样存着。节点的宽高不存，读回时按活动类型取。
- 读回时节点没有坐标，就按连线自左向右分层排出坐标，所以引擎里用代码写的定义也能直接打开。连线没有 id 时补成「源->目标#序号」，值为 `null` 的字段去掉；结构不对时抛 `TypeError`。
- 引擎定义里没列出的字段原样保留，往返之后不丢。示例里的费用审批换成引擎定义再读回与原来一致，文档站的检查会核对这一点。

保存时把 `toWorkflowDefinition(designer.schema)` 交给后端，引擎在发布时再按它自己的规则把关；打开时把后端给的定义交给 `fromWorkflowDefinition`，结果赋给 `schema`。
