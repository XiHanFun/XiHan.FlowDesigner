# 设计器

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`<xh-flow-designer>` 编辑流程定义，类在 `@xihan-flow/designer` 里导出为 `XhFlowDesigner`，调用 `defineFlowDesigner()` 注册。用法见[设计器](../guide/designer)。

## 元素 xh-flow-designer

### 属性

| 属性 | attribute | 类型 | 说明 |
| --- | --- | --- | --- |
| `readonly` | `readonly` | `boolean \| undefined` | 只读：可以选择与浏览，不能修改；缺省 false。同名 attribute 三态：不写为缺省，写 "false" 为 false，其余写法（空串、"true" 等）为 true。 |
| `grid` | — | `number \| false` | 拖动与新建节点时吸附的网格边长，false 不吸附网格；缺省 16。 |
| `snap` | — | `boolean` | 拖动时吸附其它节点并显示对齐线；缺省 true。 |
| `panels` | `panels` | `string \| undefined` | 要显示的面板，空格分隔：toolbar palette properties issues minimap。不写即全部显示，写空串则全部收起；同名 attribute。 |
| `paletteGroupOrder` | — | `readonly string[] \| undefined` | 物料面板里先列出的类别及其顺序，其余类别按登记顺序排在后面。 |
| `paletteGroupLabels` | — | `Readonly<Record<string, string>> \| undefined` | 物料面板的类别标题，缺省直接显示 category。 |
| `propertyGroupOrder` | — | `readonly string[] \| undefined` | 属性面板里先列出的分组及其顺序，其余分组按首次出现的顺序排在后面。 |
| `propertyGroupLabels` | — | `Readonly<Record<string, string>> \| undefined` | 属性面板的分组标题，缺省直接显示分组 id。 |
| `commandLayout` | — | `DesignerCommandLayout \| undefined` | 工具栏与各右键菜单的命令排列：toolbar、menu:node、menu:edge、menu:blank → 若干组命令 id。写了某个位置就只显示列出的命令；没写的位置用内置排列，再把 placement 含它的扩展命令追加成一组。 |
| `validateOptions` | — | `Omit<FlowValidateOptions, 'extensions'> \| undefined` | 校验选项：按问题码覆盖严重程度，扩展规则的问题码也认。 |
| `router` | — | `FlowEdgeRouter \| undefined` | 连线路由器，缺省为直角路由。 |
| `translations` | — | `Partial<FlowDesignerTranslations> \| undefined` | 元素自己的文案，压在全局配置之上。 |

### 存取器

| 属性 | 读写 | 类型 | 说明 |
| --- | --- | --- | --- |
| `schema` | 可读写 | `FlowDocument` | 流程定义。赋值时装载、清空撤销历史并重新自动适配（赋回当前这一份不重新装载）；读取时得到当前定义。 |
| `extensions` | 可读写 | `readonly FlowDesignerExtension[] \| undefined` | 扩展：节点类型、节点渲染、属性编辑器、命令、面板、导入器与导出器都从这里来，内置扩展自动排在最前。赋值时当场合并查重，冲突抛 DesignerExtensionError、什么都不变；各扩展的 setup 在元素连上文档时调用、断开时清理。同一个扩展对象换了引用当作卸下再装上，宿主要保持引用稳定。 |
| `canUndo` | 只读 | `boolean` | 有可以撤销的一步。 |
| `canRedo` | 只读 | `boolean` | 有可以重做的一步。 |
| `canPaste` | 只读 | `boolean` | 剪贴板里有内容，paste() 能贴出东西。 |
| `canImport` | 只读 | `boolean` | 装了导入器：粘贴与拖进画布的外部内容、openFile() 选的文件都交给它们。 |
| `dirty` | 只读 | `boolean` | 有未保存的修改。 |

### 方法

| 方法 | 说明 |
| --- | --- |
| `execute(operations: readonly FlowOperation[], options?: ExecuteOptions): FlowDocument` | 执行一组操作并记为一步撤销；返回新的定义。 |
| `undo(): boolean` | 撤销一步；没有可撤销的返回 false。 |
| `redo(): boolean` | 重做一步；没有可重做的返回 false。 |
| `markSaved(): void` | 把当前状态记为已保存。 |
| `addNode(type: string, at?: FlowPoint): FlowNode` | 新建节点并选中：at 是节点中心的世界坐标，缺省放在视口中央；位置吸附网格。 |
| `select(selection: Partial<FlowSelection>): void` | 换成选中这些节点与连线，没写的一类清空。 |
| `getSelection(): FlowSelection` | 当前选中的节点与连线。 |
| `deleteSelection(): boolean` | 删除选中的节点（连带相连的连线）与连线；只读或没有选中时返回 false。 |
| `copy(): FlowClipboard \| undefined` | 复制选中的节点与两端都被选中的连线，同时写进系统剪贴板；没有选中节点时返回 undefined。 |
| `cut(): FlowClipboard \| undefined` | 复制选中内容后删除选中的节点与连线，同时写进系统剪贴板；只读或没有选中节点时返回 undefined。 |
| `paste(clipboard?: FlowClipboard): FlowSelection` | 粘贴并选中粘贴出的对象，返回它们；每次比上一次多偏移一格网格（不吸附网格时 24）。缺省用设计器剪贴板里的内容，给了 clipboard 时它成为剪贴板内容；只读时什么都不做，返回空选择。 |
| `openFile(): void` | 弹出选择文件的对话框，选中的文件交给导入器：按扩展顺序问 accepts，第一个接下的导入；导入的片段放在视口中央，整份流程定义换掉当前定义。没有导入器接下时派发 import-error。只读或没有导入器时什么都不做。 |
| `export(format: string, options?: Readonly<Record<string, unknown>>): Promise<Blob \| string>` | 导出成文件：交给登记了这种格式的第一个导出器，options 原样交给它；没有导出器认这种格式时返回以 RangeError 拒绝的 Promise。 |
| `duplicate(): FlowSelection` | 复制选中内容并立即粘贴，偏移一格网格，不改动剪贴板；只读时什么都不做，返回空选择。 |
| `align(mode: AlignMode): void` | 对齐选中的节点；少于两个或只读时什么都不做。 |
| `distribute(axis: DistributeAxis): void` | 等距分布选中的节点；少于三个或只读时什么都不做。 |
| `autoLayout(options?: FlowAutoLayoutOptions): void` | 按连线方向分层排布全部节点，左上角保持在原处，并清除连线的手动拐点；记为一步，只读时什么都不做。 |
| `validate(): FlowIssue[]` | 按当前扩展与校验选项校验定义。 |
| `getViewport(): Viewport` | 当前视口。 |
| `setViewport(viewport: Viewport): void` | 设置视口；此后尺寸变化不再自动适配。 |
| `zoomToFit(): void` | 缩放并平移到让整张图落在视口中央，小图不放大到 100% 以上；此后尺寸变化时重新适配，直到设置视口或在画布上按下指针。 |
| `zoomIn(): void` | 以视口中心放大一档。 |
| `zoomOut(): void` | 以视口中心缩小一档。 |
| `zoomToActual(): void` | 缩放到 100% 并把整张图居中。 |
| `scrollToNode(id: string): void` | 把节点居中显示。 |
| `revealNode(id: string): void` | 节点没整个落在视口内时把它居中，已在视口内则不动。 |
| `clientToWorld(clientX: number, clientY: number): FlowPoint` | 浏览器视口坐标换成画布的世界坐标。 |

### 事件

事件都是冒泡的 `CustomEvent`。

| 事件 | detail | 说明 |
| --- | --- | --- |
| `schema-change` | `{ schema: FlowDocument, operations: readonly FlowOperation[], kind: FlowSchemaChangeKind }` | 流程定义变了：带新定义、这次的操作与种类；拖动等成组的修改在结束时合成一次派发，装载新定义时 operations 为空。 |
| `selection-change` | `FlowSelection` | 选中的节点与连线变了。 |
| `dirty-change` | `{ dirty: boolean }` | 有没有未保存的修改变了。 |
| `issues-change` | `{ issues: readonly FlowIssue[] }` | 流程定义、扩展或校验选项变了之后重新校验，带全部问题。 |
| `connect-reject` | `{ source: FlowEndpoint, target: FlowEndpoint, problems: readonly FlowConnectionProblem[] }` | 拖出或改连的连线违反连接约束，没有连上；带两端与全部问题。 |
| `node-dblclick` | `{ id: string }` | 双击了节点。 |
| `node-contextmenu` | `{ id: string, x: number, y: number }` | 在节点上打开右键菜单，节点没被选中时先选中它；可以取消，取消后内置菜单与浏览器的右键菜单都不出现。 |
| `edge-contextmenu` | `{ id: string, x: number, y: number }` | 在连线上打开右键菜单，连线没被选中时先选中它；可以取消。 |
| `blank-contextmenu` | `{ x: number, y: number }` | 在画布空白处打开右键菜单；可以取消。 |
| `viewport-change` | `{ viewport: Viewport }` | 视口变了：缩放、平移、适配与 setViewport 都会派发。 |
| `import-error` | `{ importer?: string, source: DesignerImportSource, error: unknown }` | 导入没有成功：导入器抛了错，或给出的节点、连线或流程定义不合法、用了没登记的节点类型，importer 是导入器的 id；openFile() 选的文件没有导入器接下时也派发，此时没有 importer。 |
| `export` | `{ format: FlowImageFormat, blob: Blob }` | 工具栏的导出命令导出了图片，带格式与文件；可以取消，取消后设计器不自己下载，宿主拿 blob 自己存。没被取消时存成 flow.png 或 flow.svg 下载。 |
| `save` | `Record<string, never>` | 画布有焦点时按了 Ctrl / ⌘ + S；设计器不自己保存。 |

## 注册

### defineFlowDesigner() {#defineflowdesigner}

```ts
declare function defineFlowDesigner(): void
```

注册 &lt;xh-flow-designer&gt; 与它用到的 UI 元素、设计器零件（零件各自带上它们内部用的 UI 元素）；宿主不必再全量注册。重复调用不报错。

## 内置命令

内置命令登记在 `FLOW_DESIGNER_EXTENSION` 里，工具栏、右键菜单与 `commandLayout` 都按 id 引用。名称取自中文语言包；快捷键在画布有焦点时生效，Ctrl / ⌘ 在 macOS 上是 ⌘，其它系统是 Ctrl。

| 命令 | 名称 | 快捷键 | 只读时 |
| --- | --- | --- | --- |
| `open-file` | 打开文件 | — | 不可用 |
| `undo` | 撤销 | `Ctrl / ⌘ + Z` | 不可用 |
| `redo` | 重做 | `Ctrl / ⌘ + Shift + Z` | 不可用 |
| `copy` | 复制 | — | 可用 |
| `cut` | 剪切 | — | 不可用 |
| `paste` | 粘贴 | — | 不可用 |
| `delete` | 删除 | `Delete` | 不可用 |
| `duplicate` | 创建副本 | `Ctrl / ⌘ + D` | 不可用 |
| `select-all` | 全选 | `Ctrl / ⌘ + A` | 可用 |
| `align-left` | 左对齐 | — | 不可用 |
| `align-center` | 水平居中 | — | 不可用 |
| `align-right` | 右对齐 | — | 不可用 |
| `align-top` | 顶端对齐 | — | 不可用 |
| `align-middle` | 垂直居中 | — | 不可用 |
| `align-bottom` | 底端对齐 | — | 不可用 |
| `distribute-horizontal` | 水平等距 | — | 不可用 |
| `distribute-vertical` | 垂直等距 | — | 不可用 |
| `auto-layout` | 自动布局 | — | 不可用 |
| `clear-vertices` | 清除拐点 | — | 不可用 |
| `zoom-out` | 缩小 | `-` | 可用 |
| `zoom-in` | 放大 | `+` | 可用 |
| `zoom-to-fit` | 适配 | `0` | 可用 |
| `zoom-to-actual` | 100% | — | 可用 |
| `export-png` | 导出 PNG | — | 可用 |
| `export-svg` | 导出 SVG | — | 可用 |

### FLOW_TOOLBAR_LAYOUT {#flow_toolbar_layout}

工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。有导入器时前面再加一组打开文件，见 flowToolbarLayout。

| 组 | 命令 |
| --- | --- |
| 1 | `undo` `redo` |
| 2 | `delete` `duplicate` |
| 3 | `align-left` `align-center` `align-right` `align-top` `align-middle` `align-bottom` `distribute-horizontal` `distribute-vertical` `auto-layout` |
| 4 | `zoom-out` `zoom-in` `zoom-to-fit` `zoom-to-actual` |
| 5 | `export-png` `export-svg` |

### flowToolbarLayout() {#flowtoolbarlayout}

```ts
declare function flowToolbarLayout(hasImporters: boolean): (readonly string[])[]
```

工具栏此刻的缺省排列：有导入器时在 FLOW_TOOLBAR_LAYOUT 前面多一组打开文件。

### flowMenuLayout() {#flowmenulayout}

```ts
declare function flowMenuLayout(subject: FlowMenuSubject, selectedNodes: number): string[][]
```

右键菜单的缺省排列：节点菜单在选中两个以上时加对齐，三个以上时加分布。

### FlowMenuSubject {#flowmenusubject}

```ts
type FlowMenuSubject = 'node' | 'edge' | 'blank'
```

右键菜单落在哪类对象上。

## 类型

### FlowSchemaChangeKind {#flowschemachangekind}

```ts
type FlowSchemaChangeKind = 'execute' | 'undo' | 'redo' | 'load'
```

schema-change 的种类：执行操作、撤销、重做，或宿主装载了新定义。

### FlowDesignerPanel {#flowdesignerpanel}

```ts
type FlowDesignerPanel = 'toolbar' | 'palette' | 'properties' | 'issues' | 'minimap'
```

可以开关的面板。

### FlowSelection {#flowselection}

选中的节点与连线 id，各自按选中先后排列。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `readonly string[]` | 选中的节点 id。 |
| `edges` | `readonly string[]` | 选中的连线 id。 |

### FlowClipboard {#flowclipboard}

剪贴板内容：被复制的节点及两端都在其中的连线。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `readonly FlowNode[]` | 被复制的节点。 |
| `edges` | `readonly FlowEdge[]` | 两端都在 nodes 里的连线。 |

### FlowAutoLayoutOptions {#flowautolayoutoptions}

自动布局选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `direction?` | `LayeredDirection` | 分层方向：TB 自上而下、BT 自下而上、LR 自左而右、RL 自右而左；缺省 TB。 |
| `nodeGap?` | `number` | 同层相邻两节点之间的空隙，缺省 24。 |
| `layerGap?` | `number` | 相邻两层之间的空隙，缺省 48。 |
| `label?` | `string` | 这一步的说明，供撤销重做按钮提示。 |

## 文案

### FlowDesignerTranslations {#flowdesignertranslations}

设计器的文案。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `label` | `string` | 画布区域的可访问名。 |
| `toolbar` | `string` | 工具栏的可访问名。 |
| `openFile` | `string` | 选一个文件交给导入器。 |
| `undo` | `string` |  |
| `redo` | `string` |  |
| `delete` | `string` |  |
| `duplicate` | `string` |  |
| `copy` | `string` |  |
| `cut` | `string` |  |
| `paste` | `string` |  |
| `selectAll` | `string` |  |
| `alignLeft` | `string` |  |
| `alignCenter` | `string` | 各自的中心落到同一条竖直中线上。 |
| `alignRight` | `string` |  |
| `alignTop` | `string` |  |
| `alignMiddle` | `string` | 各自的中心落到同一条水平中线上。 |
| `alignBottom` | `string` |  |
| `distributeHorizontal` | `string` |  |
| `distributeVertical` | `string` |  |
| `autoLayout` | `string` |  |
| `clearVertices` | `string` | 去掉连线的手动拐点，交回自动路由。 |
| `zoomIn` | `string` |  |
| `zoomOut` | `string` |  |
| `zoomToFit` | `string` |  |
| `zoomToActual` | `string` |  |
| `exportPng` | `string` | 导出成 PNG 图片。 |
| `exportSvg` | `string` | 导出成 SVG 图片。 |
| `exportImage` | `string` | 内置图片导出器的名称。 |
| `palette` | `string` | 物料面板的标题。 |
| `paletteUncategorized` | `string` | 没有类别的节点类型所在分组的标题。 |
| `propertiesEmpty` | `string` | 没有选中时属性面板里的提示。 |
| `edge` | `string` | 属性面板里连线的类型名。 |
| `issuesEmpty` | `string` | 没有问题时问题列表里的提示。 |
| `flow` | `string` | 不落在节点或连线上的问题（如节点个数）所属的对象名。 |

| 方法 | 说明 |
| --- | --- |
| `propertiesMultiple(count: number): string` | 选中多个对象时属性面板标题下的一行。 |
| `propertyLabel(key: string): string` | 属性描述没有给 label 时的标签，key 是 formatJsonPath 写出的属性路径。 |
| `issue(issue: FlowIssue, names: FlowIssueNames): string` | 问题的说明文字。 |
| `propertyIssue(property: string, message: string): string` | 落在某个属性上的问题：属性名与问题说明拼在一起。 |

### FlowDesignerLocale {#flowdesignerlocale}

一种语言的设计器文案：问题说明与内建属性名写成表，其余与 FlowDesignerTranslations 相同。

继承 `Omit<FlowDesignerTranslations, 'issue' | 'propertyLabel'>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `issues` | `Readonly<Record<FlowIssueCode, FlowIssueMessage>>` | 每个问题码的说明。 |
| `propertyLabels` | `Readonly<Record<FlowBuiltinPropertyKey, string>>` | 内建属性没有给 label 时的属性名。 |

### FlowIssueMessage {#flowissuemessage}

```ts
type FlowIssueMessage = (text: (key: string) => string, type: (key: string) => string) => string
```

一条问题说明：text 取参数的文字，type 取参数里那个节点类型的显示名。

### FlowBuiltinPropertyKey {#flowbuiltinpropertykey}

```ts
type FlowBuiltinPropertyKey = 'label' | 'style.dashed'
```

设计器内建的属性路径，formatJsonPath 的写法。

## 全部导出

### clipboard

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `decodeFlowClipboard` | 函数 | 解析剪贴板文本：不是流程的剪贴板包、版本不认得、节点或连线的结构不合法、id 重复时返回 undefined。 |
| `encodeFlowClipboard` | 函数 | 把剪贴板内容序列化成剪贴板包的 JSON 文本。 |

### editor

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FlowAutoLayoutOptions` | 接口 | 自动布局选项。 |
| `FlowClipboard` | 接口 | 剪贴板内容：被复制的节点及两端都在其中的连线。 |
| `FlowSelection` | 接口 | 选中的节点与连线 id，各自按选中先后排列。 |

### extensions

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFlowDesignerModel` | 函数 | 合出设计器用的模型；任何一处重名都抛 DesignerExtensionError。 |
| `FLOW_DESIGNER_EXTENSION` | 常量 | 设计器的内置扩展：内置命令与图片导出器。 |
| `FLOW_TOOLBAR_LAYOUT` | 常量 | 工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。 |
| `FlowDesignerCommand` | 类型 | 设计器的命令。 |
| `FlowDesignerContext` | 接口 | 命令、面板与扩展装上时拿到的上下文。 |
| `FlowDesignerExporter` | 类型 | 导出器：把当前流程定义换成文件。 |
| `FlowDesignerExtension` | 接口 | 流程设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、导入器、导出器与 setup。 |
| `FlowDesignerImporter` | 类型 | 导入器：把粘贴、拖放或打开的文件换成片段或整份流程定义；返回 undefined 即什么都不放。 |
| `FlowDesignerModel` | 接口 | 一组设计器扩展合出的东西：交给 core 函数的列表、运行时模型、命令表、属性编辑器表、导入器与导出器。 |
| `FlowExportContext` | 接口 | 导出时交给导出器的上下文：设计器的上下文，加上调用 export() 时给的选项。 |
| `FlowImportDocument` | 接口 | 导入的整份流程定义：换掉当前定义并记一步撤销，视口随后适配。 |
| `FlowImportFragment` | 接口 | 导入的片段：一组节点与连线，整体挪到落点后按粘贴的规则换新 id 放进流程定义，选中它们并记一步撤销。 |
| `FlowImportResult` | 类型 | 导入的结果：一个片段，或一整份流程定义。 |
| `flowMenuLayout` | 函数 | 右键菜单的缺省排列：节点菜单在选中两个以上时加对齐，三个以上时加分布。 |
| `FlowMenuSubject` | 类型 | 右键菜单落在哪类对象上。 |
| `flowToolbarLayout` | 函数 | 工具栏此刻的缺省排列：有导入器时在 FLOW_TOOLBAR_LAYOUT 前面多一组打开文件。 |

### flow-designer

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `defineFlowDesigner` | 函数 | 注册 &lt;xh-flow-designer&gt; 与它用到的 UI 元素、设计器零件（零件各自带上它们内部用的 UI 元素）；宿主不必再全量注册。 |
| `FLOW_DESIGNER_TAG` | 常量 | 设计器的标签名。 |
| `FlowDesignerEventMap` | 接口 | 设计器派发的事件；x / y 为浏览器视口坐标。 |
| `FlowDesignerPanel` | 类型 | 可以开关的面板。 |
| `FlowSchemaChangeKind` | 类型 | schema-change 的种类：执行操作、撤销、重做，或宿主装载了新定义。 |
| `XhFlowDesigner` | 类 | 流程设计器 &lt;xh-flow-designer&gt;：在画布上编辑流程定义。 |

### panels/properties

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FlowPropertyEditor` | 类型 | 宿主提供的属性编辑器。 |
| `FlowPropertyEditorContext` | 类型 | 交给属性编辑器的上下文：target 是当前全部被编辑的对象。 |
| `FlowPropertyEditorInstance` | 类型 | 属性编辑器实例。 |
| `FlowPropertyTarget` | 类型 | 交给属性编辑器的对象：kind 是节点类型（连线为 edge，流程定义为 document），value 是节点、连线或流程定义本身。 |
