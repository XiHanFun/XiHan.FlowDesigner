# 扩展

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

扩展分三层：core 层登记节点类型、属性、编辑方式与规则，校验与编辑操作只读这一层；运行时层再加节点内容的渲染，见[查看器参考](./viewer#flowruntimeextension)；设计器层再加属性编辑器、命令、面板、导入器、导出器与 `setup`。下层的扩展对象可以直接交给上层的元素。用法见[扩展](../guide/extensions)。

## core 层

### FlowCoreExtension {#flowcoreextension}

流程 core 层的扩展：节点类型、连线属性、流程定义级属性、编辑方式与规则。运行时层与设计器层的扩展在它之上再加渲染、命令与面板，core 函数只读这里的字段。

继承 `DesignerExtensionCore<FlowDocument, FlowRuleContext>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodeTypes?` | `readonly FlowNodeTypeDefinition[]` | 节点类型；类型名在全部扩展里不能重复。 |
| `edgeProperties?` | `readonly FlowPropertyDescriptor[]` | 不随源节点类型的连线属性，path 相对连线本身，追加在内置之后；随源节点类型的写在节点类型的 outgoingEdges 上。 |
| `documentProperties?` | `readonly FlowPropertyDescriptor[]` | 流程定义级属性，path 相对文档本身，没选中任何对象时属性面板显示它们。 |

| 方法 | 说明 |
| --- | --- |
| `issueText(issue: FlowIssue): string \| undefined` | 这个扩展自己的问题码的说明文字；返回 undefined 时交给设计器的文案。 |

### DesignerExtensionCore {#designerextensioncore}

扩展里只含纯数据与纯函数的部分：校验、计算这类 core 函数读它。

`FlowCoreExtension` 从 XiHan.UI 继承的字段。

类型参数 `Doc = unknown`、`RuleCtx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 全局唯一，用包名加功能名：@xihan-flow-pro/simulation。也是模板里扩展数据的键。 |
| `controls?` | `Readonly<Record<string, ControlKind>>` | 新的编辑方式，键是 control.kind，不能与内建的重名。 |
| `rules?` | `readonly SchemaRule<Doc, RuleCtx>[]` | 校验规则，问题与内置校验的一起进问题列表；问题码以 id 的末段加点开头。 |

### SchemaRule {#schemarule}

```ts
type SchemaRule<Doc = unknown, RuleCtx = unknown> = (document: Doc, context: RuleCtx) => readonly SchemaIssue[]
```

校验规则：给出文档的问题。问题码必须以扩展 id 的末段加点开头，如 xihan-workflow.decision-no-default。

### FlowRuleContext {#flowrulecontext}

规则拿到的上下文：合并后的节点类型。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodeTypes` | `FlowNodeTypeRegistry` | 全部扩展登记的节点类型。 |

### ControlKind {#controlkind}

新的编辑方式：属性描述里 control.kind 等于登记的键时，checkProperties 用它校验取值。

| 方法 | 说明 |
| --- | --- |
| `check(value: JsonValue, control: { readonly kind: string }): string \| undefined` | 检查已填写的取值；没问题返回 undefined，否则给出问题码。不给即不检查取值。 |

### createFlowModel() {#createflowmodel}

```ts
declare function createFlowModel(extensions?: readonly FlowCoreExtension[]): FlowModel
```

合出流程模型：内置扩展 FLOW_CORE_EXTENSION 在前，extensions 按顺序在后。扩展 id、节点类型、属性路径、编辑方式等重名时抛 DesignerExtensionError；节点类型的 outgoingEdges 与不随源节点类型的连线属性同路径也抛。同一个数组只合一次：元素把同一份 extensions 交给各个 core 函数时不重复合并。

### FlowModel {#flowmodel}

一组扩展合出的流程模型：节点类型、连线与流程定义级属性、编辑方式。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `extensions` | `readonly FlowCoreExtension[]` | 内置扩展在前，传入的按顺序在后。 |
| `nodeTypes` | `FlowNodeTypeRegistry` | 全部扩展登记的节点类型。 |
| `edgeProperties` | `readonly FlowPropertyDescriptor[]` | 不随源节点类型的连线属性。 |
| `documentProperties` | `readonly FlowPropertyDescriptor[]` | 流程定义级属性。 |
| `controls` | `Readonly<Record<string, ControlKind>>` | 扩展登记的编辑方式。 |

| 方法 | 说明 |
| --- | --- |
| `edgePropertiesOf(sourceType: string \| undefined): readonly FlowPropertyDescriptor[]` | 某条连线的属性：不随源节点类型的，加上源节点类型的 outgoingEdges；源节点类型未知时只有前者。 |
| `issueText(issue: FlowIssue): string \| undefined` | 问题的说明文字：按扩展顺序取第一个给出的；都不给时为 undefined。 |

## 节点类型

### FlowNodeTypeDefinition {#flownodetypedefinition}

节点类型定义：同时驱动物料面板、属性面板、连线约束与结构校验。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `string` | 类型名，节点的 type 写它。 |
| `label?` | `string` | 显示名：物料面板、属性面板的标题与问题说明里用它，不给时显示 type；节点自己没写标签时画布上也显示它。 |
| `category?` | `string` | 物料面板里的类别，按它分组。 |
| `icon?` | `IconRecord` | 图标：内置的节点渲染画在文字前面，物料面板的条目也显示它；自定义的节点渲染可以从节点类型上读它。 |
| `size` | `FlowSize` | 新建节点的尺寸。 |
| `ports` | `FlowPortPreset \| readonly FlowPortDefinition[]` | 端口：预设，或具名端口的列表。 |
| `defaults?` | `FlowNodeDefaults` | 新建节点时写入的标签与 data。 |
| `connection?` | `FlowConnectionRule` | 连接约束：入出线条数与能连的节点类型。 |
| `entry?` | `boolean` | 作为可达性分析的起点，且不要求有入线。 |
| `terminal?` | `boolean` | 不要求有出线。 |
| `minCount?` | `number` | 文档中该类型节点的最少个数。 |
| `maxCount?` | `number` | 文档中该类型节点的最多个数。 |
| `properties?` | `readonly FlowPropertyDescriptor[]` | 属性面板里的属性，path 相对节点本身；校验按它们检查取值。 |
| `outgoingEdges?` | `readonly FlowPropertyDescriptor[]` | 从这类节点连出的连线多出的属性，path 相对连线本身，如决策节点出线的条件与是否默认分支。 |
| `outgoingEdgeStyles?` | `readonly FlowEdgeStyleRule[]` | 从这类节点连出的连线按数据给的外观，如条件分支的默认分支画成虚线：按先后逐条看，满足的依次并上。连线自己写的 style 逐项压过它们；推出的外观只用于绘制，不写回流程定义。 |
| `meta?` | `JsonObject` | 扩展自用的数据；内核不解释。 |

### FlowPortPreset {#flowportpreset}

```ts
type FlowPortPreset = 'in' | 'out' | 'both' | 'none'
```

端口预设：in 为左侧入口 in，out 为右侧出口 out，both 为两者都有，none 为无端口。

### FlowPortDefinition {#flowportdefinition}

具名端口定义。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 端口 id，连线端点的 port 写它；同一节点类型里不能重复。 |
| `direction` | `FlowPortDirection` | 方向：in 只能连入，out 只能连出，both 两样都行。 |
| `side` | `FlowPortSide` | 端口在节点的哪条边上。 |
| `offset?` | `number` | 沿所在边从左到右或从上到下的相对位置，取值 0 到 1，缺省 0.5。 |
| `label?` | `string` | 端口的显示名：设计器把它写在端口外侧，随端口一起显出；内核不解释。 |
| `maxConnections?` | `number` | 该端口最多连接的连线数。 |

### FlowPortDirection {#flowportdirection}

```ts
type FlowPortDirection = 'in' | 'out' | 'both'
```

端口方向：只入、只出或双向。

### FlowPortSide {#flowportside}

```ts
type FlowPortSide = 'top' | 'right' | 'bottom' | 'left'
```

端口所在的节点边。

### FlowConnectionRule {#flowconnectionrule}

连接约束。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `maxIncoming?` | `number` | 最大入度。 |
| `maxOutgoing?` | `number` | 最大出度。 |
| `allowedTargets?` | `readonly string[]` | 允许连向的节点类型；缺省时不限。 |
| `allowedSources?` | `readonly string[]` | 允许连入的来源节点类型；缺省时不限。 |
| `allowSelfLoop?` | `boolean` | 是否允许连向自身，缺省不允许。 |

### FlowNodeDefaults {#flownodedefaults}

新建节点时的默认值。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `label?` | `string` | 新节点的标签。 |
| `data?` | `JsonObject` | 新节点的 data，每次新建时深拷贝一份。 |

### FlowEdgeStyleRule {#flowedgestylerule}

按连线数据给的外观：when 对连线本身求值，满足时并上 style。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `when` | `PropertyCondition` | 条件，路径相对连线本身，如 ['data', 'isDefault']；写法同属性描述的 visibleWhen。 |
| `style` | `FlowEdgeStyle` | 满足条件时的外观。 |

## 属性描述

### FlowPropertyDescriptor {#flowpropertydescriptor}

```ts
type FlowPropertyDescriptor = PropertyDescriptor<FlowPropertyControl>
```

节点属性描述：path 相对节点本身，如 ['data', 'properties', 'Url']、['label']。

### FlowPropertyControl {#flowpropertycontrol}

```ts
type FlowPropertyControl = PropertyControl | { readonly kind: string }
```

节点属性的编辑方式：内建的编辑方式之外，扩展可以登记自己的种类（如受理人选择），编辑器由设计器层的扩展提供。

### PropertyDescriptor {#propertydescriptor}

一个可编辑属性。C 是编辑方式，产品可在内建之外扩展自己的种类：`PropertyDescriptor<PropertyControl | { kind: 'stroke' }>`。

类型参数 `C extends { readonly kind: string } = PropertyControl`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `path` | `JsonPath` | 值相对被编辑对象（节点、元素、字段本身）的路径。 |
| `control` | `C` | 编辑方式：kind 定用哪种编辑器、按什么校验，其余字段是这种方式的选项（选项表、数值约束等）。 |
| `group?` | `string` | 分组 id；分组的先后与文案由产品决定。 |
| `label?` | `string` | 标签；不给时由产品按 formatJsonPath(path) 去语言包里查。 |
| `required?` | `boolean` | 显示时必须填写，按 isFilled 判空。 |
| `default?` | `JsonValue` | 新建时写入的缺省值；不给就不写。 |
| `visibleWhen?` | `PropertyCondition` | 显示条件；缺省总是显示。 |
| `meta?` | `JsonObject` | 产品自用，内核不解释。 |

### PropertyCondition {#propertycondition}

```ts
type PropertyCondition = { readonly path: JsonPath, readonly equals: JsonValue } | { readonly path: JsonPath, readonly oneOf: readonly JsonValue[] } | { readonly path: JsonPath, readonly filled: boolean } | { readonly all: readonly PropertyCondition[] } | { readonly any: readonly PropertyCondition[] } | { readonly not: PropertyCondition }
```

显示条件：path 与属性描述的 path 一样相对被编辑的对象，可用 all / any / not 组合。

## 设计器层

### FlowDesignerExtension {#flowdesignerextension}

流程设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、物料来源、导入器、导出器与 setup。

继承 `FlowRuntimeExtension`、`Omit<DesignerShellExtension<FlowDesignerContext, FlowPropertyEditor, FlowDocument, FlowRuleContext, FlowPoint>, 'importers' | 'exporters'>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `importers?` | `readonly FlowDesignerImporter[]` | 导入器：粘贴、拖放与打开文件共用，按扩展顺序问 accepts，第一个接下的导入；id 不能与别的导入器重名。 |
| `exporters?` | `readonly FlowDesignerExporter[]` | 导出器：export(format) 交给登记了这种格式的第一个；id 不能与别的导出器重名。 |

### DesignerExtensionBase {#designerextensionbase}

设计器层的扩展：在 core 部分之上加属性编辑器、命令、导入导出与装上时的回调。各款在此之上加自己的种类、渲染与面板。

`FlowDesignerExtension` 从 XiHan.UI 继承的字段。`importers`、`exporters` 由流程收窄了结果与上下文的类型，见上表。

类型参数 `Ctx = unknown`、`Editor = PropertyEditor`、`Doc = unknown`、`RuleCtx = unknown`。

继承 `DesignerExtensionCore<Doc, RuleCtx>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `editors?` | `PropertyEditorLayer<Editor>` | 属性编辑器，按扩展顺序压在设计器内建的之上。 |
| `commands?` | `readonly DesignerCommand<Ctx>[]` | 命令：工具栏按钮、右键菜单项与快捷键共用；命令 id 与快捷键不能与内置或别的扩展的重名。 |
| `fieldSources?` | `readonly DesignerFieldSource[]` | 字段来源：导入字段的对话框里，排在内置的 JSON 样例与 JSON Schema 两页之后。 |

| 方法 | 说明 |
| --- | --- |
| `setup(context: Ctx): (() => void) \| void` | 装上时调用，返回卸下时的清理。 |

### DesignerShellExtension {#designershellextension}

带面板的设计器层扩展；各款的设计器扩展在此之上加种类、渲染与物料。

`FlowDesignerExtension` 从 XiHan.UI 继承的字段。

类型参数 `Ctx = unknown`、`Editor = PropertyEditor`、`Doc = unknown`、`RuleCtx = unknown`、`At = unknown`。

继承 `DesignerExtensionBase<Ctx, Editor, Doc, RuleCtx>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `panels?` | `readonly DesignerPanel<Ctx>[]` | 面板：各占外框的一个命名区，同一栏按扩展顺序上下排。 |
| `settings?` | `readonly DesignerSettingsSection[]` | 设置分区：放进设置对话框，分区 id 不能与内置的 general 或别的扩展的重名，见 collectSettingsSections。 |
| `tourSteps?` | `readonly DesignerTourStep<Ctx>[]` | 新手引导的步骤：与 designer-shell 的通用步骤、各款的步骤一起按 order 排；id 不能重名，见 collectTourSteps。 |
| `paletteSources?` | `readonly DesignerPaletteSource<Ctx, At>[]` | 物料来源：往物料面板里加的几组，排在各款内置分组之后；id 不能重名，见 collectPaletteSources。At 是各款的落点信息。 |
| `about?` | `readonly { readonly label: string, readonly value: string }[]` | 「关于」页里的几行，如附加包的版本与授权；各款把它们接在自己那几行后面。 |

### FlowDesignerContext {#flowdesignercontext}

命令、面板与扩展装上时拿到的上下文。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `designer` | `XhFlowDesigner` | 这台设计器。 |
| `translations` | `FlowDesignerTranslations` | 此刻生效的设计器文案。 |
| `commandTranslations` | `DesignerCommandsTranslations` | 此刻生效的四款共用的命令文案（designer-shell 语言包的 xh-designer-commands 一桶）。 |
| `settings` | `DesignerSettings` | 此刻生效的设置，键是「分区 id.条目 id」：设计器自己的「画布」与各扩展分区里的条目写了用写的、没写取缺省值，基础分区（general.*）只有宿主或用户写了的键。 |
| `frame` | `XhDesignerFrameElement \| undefined` | 设计器的外框：面板的开关经它；外框还没建出来时为 undefined。 |

### createFlowDesignerModel() {#createflowdesignermodel}

```ts
declare function createFlowDesignerModel(extensions: readonly FlowDesignerExtension[], editors?: PropertyEditorLayer<FlowPropertyEditor>): FlowDesignerModel
```

合出设计器用的模型；editors 是垫在各扩展之下的内建编辑器。任何一处重名（含引导步骤 id 重名或用了 shell. 前缀、物料来源 id 重名）都抛 DesignerExtensionError。

### FlowDesignerModel {#flowdesignermodel}

一组设计器扩展合出的东西：交给 core 函数的列表、运行时模型、命令表、属性编辑器表、导入器与导出器。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `list` | `readonly FlowDesignerExtension[]` | 设计器内置扩展在前、传入的在后；校验与编辑器都拿这一份。 |
| `extensions` | `readonly FlowDesignerExtension[]` | 再加上 core 层内置扩展的全部扩展，面板与命令按它的顺序。 |
| `runtime` | `FlowRuntimeModel` | 运行时模型：节点类型、属性与节点渲染。 |
| `commands` | `DesignerCommandTable<FlowDesignerContext>` | 命令 id → 命令，内置在前。 |
| `editors` | `PropertyEditorTable<FlowPropertyEditor>` | 各扩展登记的属性编辑器叠成的一张表。 |
| `importers` | `readonly FlowDesignerImporter[]` | 各扩展的导入器，按扩展顺序。 |
| `exporters` | `readonly FlowDesignerExporter[]` | 各扩展的导出器，按扩展顺序。 |
| `settings` | `readonly DesignerSettingsSection[]` | 各扩展登记的设置分区，按扩展顺序。 |
| `tourSteps` | `readonly DesignerTourStep<FlowDesignerContext>[]` | 新手引导里设计器与各扩展的步骤，按登记顺序；designer-shell 的通用步骤由零件自带。 |
| `paletteSources` | `readonly FlowPaletteSource[]` | 各扩展的物料来源，按 order 排。 |

## 命令

### FlowDesignerCommand {#flowdesignercommand}

```ts
type FlowDesignerCommand = DesignerCommand<FlowDesignerContext>
```

设计器的命令。

### DesignerCommand {#designercommand}

一条命令：工具栏按钮、右键菜单项与快捷键共用。给了 panel 是弹层命令，给了 menu 是菜单命令，在工具栏上点它分别打开锚在按钮上的弹层与菜单，两者只能给一个；两者都没给的普通命令必须有 run。登记时（mergeExtensions）不合这两条就抛 TypeError。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 全局唯一；扩展的命令用扩展 id 加点加名字，如 @xihan-flow-pro/simulation.run。 |
| `label` | `string \| ((context: Ctx) => string)` | 按钮与菜单项上的文字；给函数时每次刷新现取，随语言变。 |
| `shortLabel?` | `string \| ((context: Ctx) => string)` | 按钮上看得见的短文字：顶栏按钮图标下的那一行，工具栏只显示图标时没有图标的按钮上也写它；不给用 label。名字（读屏与提示）仍取 label，所以短文字要出现在 label 里（不分大小写），开发期不在时报一条告警。 |
| `icon?` | `IconRecord` | 按钮与菜单项上的图标，图标集见 @xihan-ui/icons；工具栏按图标显示时，没有图标的命令退回显示短文字。 |
| `placement?` | `readonly DesignerCommandPlacement[]` | 缺省排列里出现在哪些位置；不给即只经快捷键或 commandLayout 出现。 |
| `shortcut?` | `readonly string[]` | 快捷键，写法同 xh-kbd 的 keys：['Mod', 'Shift', 'P']，Mod 在 macOS 上是 ⌘，其余平台是 Ctrl。 |
| `alternateShortcuts?` | `readonly (readonly string[])[]` | 另外几组也能触发这条命令的快捷键，写法同 shortcut，如重做在 Mod+Shift+Z 之外再认 ['Ctrl', 'Y']。与 shortcut 一样查重、一样由 commandForShortcut 命中；提示里只显示 shortcut，快捷键表与 aria-keyshortcuts 全部列出（见 commandShortcuts）。 |
| `tone?` | `Tone` | 语气：按钮与菜单项按这族色显示，破坏性命令写 danger。不给即不带语气。 |

| 方法 | 说明 |
| --- | --- |
| `enabled(context: Ctx): boolean` | 不给即总是可用。 |
| `checked(context: Ctx): boolean` | 给了就是开关式命令，按钮与菜单项显示选中状态。 |
| `run(context: Ctx): void` | 执行命令；按钮、菜单项与快捷键都只在命令此刻可用时调用它。弹层命令与菜单命令可以不给：工具栏上点它们是打开弹层或菜单，不调 run；给了 run，快捷键按下时调它（通常调工具栏的 open 打开同一份）。 |
| `panel(context: Ctx): DesignerCommandPanel<Ctx>` | 弹层命令：每次打开时建出放进弹层的面板。 |
| `menu(context: Ctx): readonly DesignerCommandMenuEntry[]` | 菜单命令：每次刷新时现算菜单的各项。 |
| `select(value: string, context: Ctx): void` | 菜单命令的条目被选中时调用，value 是条目的 value；写成命令 id 的项选中时执行那条命令，不调它。 |

### DesignerCommandPlacement {#designercommandplacement}

```ts
type DesignerCommandPlacement = 'toolbar' | 'header' | `menu:${string}` | `selection:${string}`
```

命令出现的位置：工具栏；顶栏中段（插入快捷钮，图标在上、短文字在下）；某种主体的右键菜单（主体由各款定，如 node、edge、element、card、blank）；或选中某种主体时浮在选中框上的选中工具条（主体同样由各款定，如 element、text、node、multiple）。

## 导入与导出

### FlowDesignerImporter {#flowdesignerimporter}

```ts
type FlowDesignerImporter = DesignerImporter<FlowDesignerContext, FlowImportResult | undefined>
```

导入器：把粘贴、拖放或打开的文件换成片段或整份流程定义；返回 undefined 即什么都不放。

### FlowImportResult {#flowimportresult}

```ts
type FlowImportResult = FlowImportFragment | FlowImportDocument
```

导入的结果：一个片段，或一整份流程定义。

### FlowImportFragment {#flowimportfragment}

导入的片段：一组节点与连线，整体挪到落点后按粘贴的规则换新 id 放进流程定义，选中它们并记一步撤销。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `readonly FlowNode[]` |  |
| `edges?` | `readonly FlowEdge[]` | 两端都在 nodes 里的连线；别的连线丢弃。 |

### FlowImportDocument {#flowimportdocument}

导入的整份流程定义：换掉当前定义并记一步撤销，视口随后适配。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FlowDocument` |  |

### DesignerImporter {#designerimporter}

导入：把外部内容换成片段或文档，结果的形状由各款定。

类型参数 `Ctx = unknown`、`Result = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 全局唯一，写法同命令 id；不能与内置或别的扩展的导入器重名。 |
| `fileTypes?` | `readonly string[]` | 打开文件时选择框认的类型：MIME 类型（application/json、image/*）或扩展名（.json）。各款用 importerAccept 拼成 accept。 |

| 方法 | 说明 |
| --- | --- |
| `accepts(source: DesignerImportSource): boolean` | 接不接这个来源：只看类型、文件名或文本，不读文件内容，当场返回。 |
| `import(source: DesignerImportSource, context: Ctx): Result \| Promise<Result>` | 把接下的来源换成结果，可以是异步的；结果的形状与抛错后怎么报由各款定。 |

### DesignerImportSource {#designerimportsource}

导入的来源：粘贴、拖放与打开文件三处共用。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | `'clipboard' \| 'drop' \| 'file'` | 从哪里来：clipboard 粘贴，drop 拖放，file 打开文件。 |
| `mime?` | `string` | 内容的类型：文件取文件自己的类型，文本是 text/uri-list、text/html 或 text/plain。 |
| `name?` | `string` | 文件名；只有文件有。 |
| `text?` | `string` | 文本内容；只有文本有，文件的内容要从 file 里读。 |
| `file?` | `Blob` | 文件；只有文件有。 |

### FlowDesignerExporter {#flowdesignerexporter}

```ts
type FlowDesignerExporter = DesignerExporter<FlowExportContext>
```

导出器：把当前流程定义换成文件。

### FlowExportContext {#flowexportcontext}

导出时交给导出器的上下文：设计器的上下文，加上调用 export() 时给的选项。

继承 `FlowDesignerContext`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `options` | `Readonly<Record<string, unknown>>` |  |

### DesignerExporter {#designerexporter}

导出：把当前文档或渲染结果换成文件。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 全局唯一，写法同命令 id；不能与内置或别的扩展的导出器重名。 |
| `label` | `string \| ((context: Ctx) => string)` | 导出项的名称，列导出入口时显示；给函数时现取，随语言变。 |
| `formats` | `readonly string[]` | 能导出的格式，如 svg、png、xlsx。 |

| 方法 | 说明 |
| --- | --- |
| `export(format: string, context: Ctx): Promise<Blob \| string>` | 按格式导出，format 是 formats 里的一个；得到文件内容（Blob）或文本。 |

## 面板

### DesignerPanel {#designerpanel}

扩展登记的一个面板：占外框的一个命名区，区名不能与内置区或别的扩展的重名。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `region` | `DesignerFrameRegion` | 外框的命名区，即面板的登记：名字、缺省停的栏、标题、图标、能不能挪与浮出等；追加在内置区之后。 |
| `headerCommands?` | `readonly string[] \| ((context: Ctx) => readonly string[])` | 面板头操作区里的命令（命令 id），按命令表铺成只显示图标的一小条工具栏；给函数时每轮刷新现取。 |

| 方法 | 说明 |
| --- | --- |
| `create(context: Ctx): DesignerPanelInstance<Ctx>` | 面板装上时调用，建出面板实例；同一个面板对象只建一次。 |

### DesignerPanelInstance {#designerpanelinstance}

面板实例：element 放进外框的区，设计器状态变化时调用 update，撤掉前调用 destroy。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `element` | `HTMLElement` | 面板的根元素，以 slot 交给外框，放进登记的那个区。 |

| 方法 | 说明 |
| --- | --- |
| `update(context: Ctx): void` | 设计器状态变化后调用，面板按新状态刷新。 |
| `destroy(): void` | 面板被撤掉前调用。 |

### DesignerFrameRegion {#designerframeregion}

一个命名区，也就是面板的登记。区名是面板 id，同一栏的多块面板按登记顺序上下排列。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | 区名：写 slot="&lt;区名&gt;" 的子元素放进这个区，布局里也按它认面板。 |
| `position` | `DesignerFramePosition` | 区的位置；左、右、下是面板缺省停的栏。 |
| `size?` | `number` | 所在栏的缺省大小（百分比）：左右两栏占中间一行的宽度，下方一栏占中间一列的高度；取那一栏第一块面板的值。 |
| `minSize?` | `number` | 拖动时所在栏的下限（百分比），缺省 10；取那一栏第一块面板的值。外框按尺寸槽算出的下限更大时以那个为准。 |
| `label?` | `string` | 分隔条无障碍名称里的区名，缺省用 title，再缺省用 name。 |
| `title?` | `string` | 面板头的标题：给了就把这块面板画成卡片，头部写标题；只对左、右、下三个位置生效。 |
| `subtitle?` | `string` | 面板头标题下的一行副标题，如属性面板当前对象的名字。 |
| `help?` | `string` | 面板头的帮助：给了就在右上角出帮助钮，悬停或聚焦时弹出这段说明。 |
| `icon?` | `IconRecord` | 面板的图标：面板菜单、浮出小窗的标题栏里用。 |
| `anchor?` | `DesignerFrameOverlayAnchor` | position 为 overlay 时落在画布区的哪里，缺省 bottom-end。 |
| `defaultHidden?` | `boolean` | 缺省不显示。 |
| `closable?` | `boolean` | 能隐藏（面板头出关闭钮），缺省 true。 |
| `movable?` | `boolean` | 能换栏、调序，缺省 true。 |
| `floatable?` | `boolean` | 能浮出成小窗，缺省 true。 |
| `minimizable?` | `boolean` | 能收成标题条，缺省 true。 |

### DesignerFramePosition {#designerframeposition}

```ts
type DesignerFramePosition = 'header' | 'top' | 'start' | 'center' | 'end' | 'bottom' | 'status' | 'overlay'
```

区的位置：最上的顶栏、下面一条、中间一行的左、中、右、中间一列的下方、最下的状态栏，以及画布浮动件。左、右、下三个位置上的区是面板，这里写的是它缺省停的栏，用户可以挪。

## 属性编辑器

### FlowPropertyEditor {#flowpropertyeditor}

```ts
type FlowPropertyEditor = DesignerPropertyEditor
```

宿主提供的属性编辑器。

### FlowPropertyEditorContext {#flowpropertyeditorcontext}

```ts
type FlowPropertyEditorContext = PropertyEditorContext<DesignerPropertyDescriptor, readonly DesignerPropertyTarget[]>
```

交给属性编辑器的上下文：target 是当前全部被编辑的对象。

### FlowPropertyEditorInstance {#flowpropertyeditorinstance}

```ts
type FlowPropertyEditorInstance = PropertyEditorInstance<DesignerPropertyDescriptor, readonly DesignerPropertyTarget[]>
```

属性编辑器实例。

### FlowPropertyTarget {#flowpropertytarget}

```ts
type FlowPropertyTarget = DesignerPropertyTarget
```

交给属性编辑器的对象：kind 是节点类型（连线为 edge，流程定义为 document），value 是节点、连线或流程定义本身。

### PropertyEditorTable {#propertyeditortable}

编辑器查找表；E 可以是 PropertyEditor，也可以是编辑器 id。路径键用 formatJsonPath 的写法。

类型参数 `E`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `byControl` | `Readonly<Record<string, E>>` | 按编辑方式的种类。 |
| `byPath?` | `Readonly<Record<string, E>>` | 按属性路径，对所有对象种类生效。 |
| `byTarget?` | `Readonly<Record<string, Readonly<Record<string, E>>>>` | 按对象种类与属性路径，只对该种类生效。 |

### PropertyEditorContext {#propertyeditorcontext}

交给自定义编辑器的上下文；D 是属性描述，T 是被编辑的对象（如节点、元素、字段）。

类型参数 `D = unknown`、`T = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `value` | `JsonValue \| undefined` | 属性的当前值，未设置时为 undefined。 |
| `descriptor` | `D` | 正在编辑的这个属性的描述。 |
| `target` | `T` | 被编辑的对象。 |
| `readonly` | `boolean` | 只读：编辑器只显示，不写值。 |
| `issues` | `readonly PropertyIssue[]` | 落在这个属性及其里层的问题，按路径排、同一路径只留一条，没有时是空数组。复合编辑器（选项表、四边、列配置）据此把里层的问题标到对应的子项上。 |

| 方法 | 说明 |
| --- | --- |
| `setValue(value: JsonValue \| undefined): void` | 写入新值，undefined 表示清除；连续输入由设计器并为一步撤销。 |
| `commit(): void` | 一次编辑结束（如失焦）：此后的写入另起一步撤销。 |

### PropertyEditorInstance {#propertyeditorinstance}

编辑器实例：设计器把 element 放进属性面板，值或只读状态变化时调用 update，移除前调用 destroy。

类型参数 `D = unknown`、`T = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `element` | `HTMLElement` | 编辑器的根元素，设计器把它放进属性面板。 |
| `nestedIssues?` | `boolean` | 编辑器自己把里层的问题标到子项上：只有里层问题时，设计器不在这一行下面重复显示它们。 |

| 方法 | 说明 |
| --- | --- |
| `update(context: PropertyEditorContext<D, T>): void` | 值、只读状态或被编辑的对象变了时调用。 |
| `destroy(): void` | 从属性面板撤掉前调用。 |

### DesignerPropertyTarget {#designerpropertytarget}

被编辑的对象：种类（用于按对象种类查编辑器）、id、对象本身与它的属性描述。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | `string` | 对象种类，如 node、edge、element；按它查 byTarget 的编辑器。 |
| `id` | `string` | 对象 id，与种类一起认出对象。 |
| `value` | `JsonValue` | 对象本身，属性按描述的 path 从它里面读值。 |
| `descriptors` | `readonly DesignerPropertyDescriptor[]` | 这个对象的属性描述。 |
