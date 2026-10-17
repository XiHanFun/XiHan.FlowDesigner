# 扩展

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

扩展分三层：core 层登记节点类型、属性、编辑方式与规则，校验与编辑操作只读这一层；运行时层再加节点内容的渲染，见[查看器参考](./viewer#flowruntimeextension)；设计器层再加属性编辑器、命令、面板与 `setup`。下层的扩展对象可以直接交给上层的元素。用法见[扩展](../guide/extensions)。

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
| `rules?` | `readonly SchemaRule<Doc, RuleCtx>[]` |  |

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
| `icon?` | `string` | 图标名；内核与内置渲染不解释，自定义的节点渲染可以从节点类型上读它。 |
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
| `direction` | `FlowPortDirection` |  |
| `side` | `FlowPortSide` |  |
| `offset?` | `number` | 沿所在边从左到右或从上到下的相对位置，取值 0 到 1，缺省 0.5。 |
| `label?` | `string` | 端口的显示名；内核与内置渲染不解释。 |
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
| `control` | `C` |  |
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

流程设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板与 setup。

继承 `FlowRuntimeExtension`、`DesignerShellExtension<FlowDesignerContext, FlowPropertyEditor, FlowDocument, FlowRuleContext>`。

### DesignerExtensionBase {#designerextensionbase}

设计器层的扩展：在 core 部分之上加属性编辑器、命令、导入导出与装上时的回调。各款在此之上加自己的种类、渲染与面板。

`FlowDesignerExtension` 从 XiHan.UI 继承的字段。`importers`、`exporters` 两个字段流程设计器不读取。

类型参数 `Ctx = unknown`、`Editor = PropertyEditor`、`Doc = unknown`、`RuleCtx = unknown`。

继承 `DesignerExtensionCore<Doc, RuleCtx>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `editors?` | `PropertyEditorLayer<Editor>` | 属性编辑器，按扩展顺序压在设计器内建的之上。 |
| `commands?` | `readonly DesignerCommand<Ctx>[]` |  |

| 方法 | 说明 |
| --- | --- |
| `setup(context: Ctx): (() => void) \| void` | 装上时调用，返回卸下时的清理。 |

### DesignerShellExtension {#designershellextension}

带面板的设计器层扩展；各款的设计器扩展在此之上加种类、渲染与物料。

`FlowDesignerExtension` 从 XiHan.UI 继承的字段。

类型参数 `Ctx = unknown`、`Editor = PropertyEditor`、`Doc = unknown`、`RuleCtx = unknown`。

继承 `DesignerExtensionBase<Ctx, Editor, Doc, RuleCtx>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `panels?` | `readonly DesignerPanel<Ctx>[]` |  |

### FlowDesignerContext {#flowdesignercontext}

命令、面板与扩展装上时拿到的上下文。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `designer` | `XhFlowDesigner` | 这台设计器。 |
| `translations` | `FlowDesignerTranslations` | 此刻生效的设计器文案。 |

### createFlowDesignerModel() {#createflowdesignermodel}

```ts
declare function createFlowDesignerModel(extensions: readonly FlowDesignerExtension[]): FlowDesignerModel
```

合出设计器用的模型；任何一处重名都抛 DesignerExtensionError。

### FlowDesignerModel {#flowdesignermodel}

一组设计器扩展合出的东西：交给 core 函数的列表、运行时模型、命令表与属性编辑器表。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `list` | `readonly FlowDesignerExtension[]` | 设计器内置扩展在前、传入的在后；校验与编辑器都拿这一份。 |
| `extensions` | `readonly FlowDesignerExtension[]` | 再加上 core 层内置扩展的全部扩展，面板与命令按它的顺序。 |
| `runtime` | `FlowRuntimeModel` | 运行时模型：节点类型、属性与节点渲染。 |
| `commands` | `DesignerCommandTable<FlowDesignerContext>` | 命令 id → 命令，内置在前。 |
| `editors` | `PropertyEditorTable<FlowPropertyEditor>` | 各扩展登记的属性编辑器叠成的一张表。 |

## 命令

### FlowDesignerCommand {#flowdesignercommand}

```ts
type FlowDesignerCommand = DesignerCommand<FlowDesignerContext>
```

设计器的命令。

### DesignerCommand {#designercommand}

一条命令：工具栏按钮、右键菜单项与快捷键共用。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 全局唯一；扩展的命令用扩展 id 加点加名字，如 @xihan-flow-pro/simulation.run。 |
| `label` | `string \| ((context: Ctx) => string)` |  |
| `placement?` | `readonly DesignerCommandPlacement[]` | 缺省排列里出现在哪些位置；不给即只经快捷键或 commandLayout 出现。 |
| `shortcut?` | `readonly string[]` | 快捷键，写法同 xh-kbd 的 keys：['Mod', 'Shift', 'P']，Mod 在 macOS 上是 ⌘，其余平台是 Ctrl。 |
| `tone?` | `Tone` | 语气：按钮与菜单项按这族色显示，破坏性命令写 danger。不给即不带语气。 |

| 方法 | 说明 |
| --- | --- |
| `enabled(context: Ctx): boolean` | 不给即总是可用。 |
| `checked(context: Ctx): boolean` | 给了就是开关式命令，按钮与菜单项显示选中状态。 |
| `run(context: Ctx): void` |  |

### DesignerCommandPlacement {#designercommandplacement}

```ts
type DesignerCommandPlacement = 'toolbar' | `menu:${string}`
```

命令出现的位置：工具栏，或某种主体的右键菜单（主体由各款定，如 node、edge、element、card、blank）。

## 面板

### DesignerPanel {#designerpanel}

扩展登记的一个面板：占外框的一个命名区，区名不能与内置区或别的扩展的重名。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `region` | `DesignerFrameRegion` |  |

| 方法 | 说明 |
| --- | --- |
| `create(context: Ctx): DesignerPanelInstance<Ctx>` |  |

### DesignerPanelInstance {#designerpanelinstance}

面板实例：element 放进外框的区，设计器状态变化时调用 update，撤掉前调用 destroy。

类型参数 `Ctx = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `element` | `HTMLElement` |  |

| 方法 | 说明 |
| --- | --- |
| `update(context: Ctx): void` |  |
| `destroy(): void` |  |

### DesignerFrameRegion {#designerframeregion}

一个命名区。同一位置的多个区按登记顺序上下排列，共用一个可调整的大小，区与区之间可拖动分高度。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` |  |
| `position` | `DesignerFramePosition` |  |
| `size?` | `number` | 所在位置的缺省大小（百分比）：start、end 占中间一行的宽度，bottom 占中间一列的高度；取该位置第一个区的值。 |
| `minSize?` | `number` | 拖动时所在位置的下限（百分比），缺省 10；取该位置第一个区的值。 |
| `label?` | `string` | 分隔条无障碍名称里的区名，缺省用 name。 |

### DesignerFramePosition {#designerframeposition}

```ts
type DesignerFramePosition = 'top' | 'start' | 'center' | 'end' | 'bottom'
```

区的位置：上方一条、中间一行的左、中、右，以及中间一列的下方。

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
| `descriptor` | `D` |  |
| `target` | `T` |  |
| `readonly` | `boolean` |  |

| 方法 | 说明 |
| --- | --- |
| `setValue(value: JsonValue \| undefined): void` | 写入新值，undefined 表示清除；连续输入由设计器并为一步撤销。 |
| `commit(): void` | 一次编辑结束（如失焦）：此后的写入另起一步撤销。 |

### PropertyEditorInstance {#propertyeditorinstance}

编辑器实例：设计器把 element 放进属性面板，值或只读状态变化时调用 update，移除前调用 destroy。

类型参数 `D = unknown`、`T = unknown`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `element` | `HTMLElement` |  |

| 方法 | 说明 |
| --- | --- |
| `update(context: PropertyEditorContext<D, T>): void` |  |
| `destroy(): void` |  |

### DesignerPropertyTarget {#designerpropertytarget}

被编辑的对象：种类（用于按对象种类查编辑器）、id、对象本身与它的属性描述。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | `string` |  |
| `id` | `string` |  |
| `value` | `JsonValue` |  |
| `descriptors` | `readonly DesignerPropertyDescriptor[]` |  |
