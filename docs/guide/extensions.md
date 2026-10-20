---
aside: false
---

# 扩展

节点类型、属性、编辑方式、规则、节点渲染、属性编辑器、命令与面板，都经扩展登记。扩展是普通对象，按实例交给元素的 `extensions`，没有全局注册：同一页面上的两个设计器可以装不同的扩展。完整的字段见[扩展参考](../reference/extensions)。

## 三层

| 层 | 类型 | 所在的包 | 在下一层之上加了什么 | 谁读 |
| --- | --- | --- | --- | --- |
| core | `FlowCoreExtension` | `@xihan-flow/core` | 节点类型、连线与流程定义级属性、编辑方式、规则、问题说明 | 校验、编辑操作、查看器、设计器 |
| 运行时 | `FlowRuntimeExtension` | `@xihan-flow/runtime` | 节点内容的渲染 `nodeRenderers` | 查看器、设计器 |
| 设计器 | `FlowDesignerExtension` | `@xihan-flow/designer` | 属性编辑器、命令、面板、`setup` | 设计器 |

下层的扩展对象可以直接交给上层的元素，core 层的扩展同时交给查看器、设计器与 `validateDocument`。服务端或 Node.js 里只装 core 层，校验结论与设计器一致。

- `id` 全局唯一，用包名加功能名，如 `@example/leave`。它也是节点、连线与流程定义上扩展数据的键，见[业务数据与扩展数据](./schema#业务数据与扩展数据)。
- 内置扩展排在最前，传入的按数组顺序排在后面；物料、属性与命令都按这个顺序。
- 同一个扩展对象换了引用会当作卸下再装上，宿主要保持扩展数组与其中对象的引用稳定。

下面用一个请假流程走一遍：core 层登记四种节点、一种编辑方式与一条规则，设计器层再加编辑器、命令、面板与 `setup`。

## 节点类型

<<< @/examples/schemas/leave.ts#node-types

- `type` 是类型名，节点的 `type` 写它；`label` 是显示名，物料面板、属性面板与问题说明都用它。`icon` 是 XiHan.UI 的图标记录（如 `@xihan-ui/icons` 里的图标），画布上的节点与物料条目都把它画在文字前面。
- `category` 是物料面板里的类别，设计器的 `paletteGroupOrder` 与 `paletteGroupLabels` 按类别排序、换标题。
- `size` 是新建节点的尺寸，`defaults` 是新建时写入的标签与 `data`。
- `ports` 写预设或具名端口。预设 `in` 是左侧一个入口，`out` 是右侧一个出口，`both` 两者都有，`none` 没有端口；具名端口写 `id`、方向（`in`、`out`、`both`）、所在的边与沿边的相对位置，还可以限制连线条数；写了 `label` 的端口，设计器把名字写在端口外侧，随端口一起显出。连线的端点不写端口时，取方向相符的第一个端口。
- `entry` 的节点是可达性分析的起点，不要求有入线；`terminal` 的节点不要求有出线。`minCount`、`maxCount` 限制这类节点的个数。
- `connection` 是连接约束：入线、出线的最多条数，能连向、能接受的节点类型，以及是否允许连向自己。设计器拖动连线时按它判断能不能连，校验也按它报问题。

## 属性

`properties` 是属性面板里列出的属性，`path` 相对节点本身：`['label']` 是标签，`['data', …]` 写进节点的业务数据。每个属性写编辑方式 `control`，内建的有 `text`、`number`、`boolean`、`select`、`tags`、`color`、`json` 等，全部种类与取值约束见 XiHan.UI 的 [designer-kit](https://ui.docs.xihanfun.com/runtime/designer-kit)。

- `group` 是属性面板里的分组，设计器的 `propertyGroupOrder` 与 `propertyGroupLabels` 按分组排序、换标题；`label` 是字段名。
- `required` 的属性必须填写；`default` 是新建节点或连线时写入的缺省值；`visibleWhen` 按别的属性的值决定显不显示。
- 校验按属性描述检查取值：必填没填、类型不对、超出范围、不在选项里等，问题码见[问题码](../reference/issues)。

连线的属性有两处：节点类型的 `outgoingEdges` 只加在从这类节点连出的连线上，如审批的结果；扩展的 `edgeProperties` 加在所有连线上。连线的标签与虚线是内置的连线属性。节点类型的 `outgoingEdgeStyles` 按连线数据给从这类节点连出的连线外观，如 `{ when: { path: ['data', 'isDefault'], equals: true }, style: { dashed: true } }` 把默认分支画成虚线；`when` 的写法同属性描述的 `visibleWhen`，路径相对连线本身。连线自己写的外观压过推出的，推出的外观只用于绘制，不写回流程定义。扩展的 `documentProperties` 是流程定义级的属性，什么都没选中时属性面板编辑它们。

## 编辑方式

内建的编辑方式不够用时，在 `controls` 里登记新的种类，键就是属性描述里的 `control.kind`，不能与内建的重名。`check` 检查已经填写的取值，返回问题码表示不合格：

<<< @/examples/schemas/leave.ts#control

core 层只管取值对不对；属性面板里用什么控件编辑它，由设计器层的扩展按种类提供编辑器，见下文的[属性编辑器](#属性编辑器)。没有登记的种类在校验时报 `unknown-control`。

## 规则

规则检查节点类型与属性描述表达不了的约束，拿到流程定义与合并后的节点类型，返回问题：

<<< @/examples/schemas/leave.ts#rules

- 问题码必须以扩展 id 的末段加点开头，`@example/leave` 的规则写 `leave.` 开头的码，不符时校验当场抛 `TypeError`。
- `path` 从流程定义的根算起；带上 `target` 时，设计器在问题列表里点这条问题会选中并显露那个对象，节点上也会标出问题。
- `severity` 不写按错误处理。宿主可以用 `validateOptions.severity` 按问题码改写，扩展的问题码也认。

问题的说明由扩展的 `issueText` 给出，返回 `undefined` 时交给设计器的文案：

<<< @/examples/schemas/leave.ts#extension

## 设计器层

设计器层的扩展可以与 core 层的分开写，一起放进 `extensions`。下面的示例里，审批人用下拉框选，工具栏多了「加一个审批」与「吸附网格」，右侧多了一块统计，双击节点时连同它的出线一起选中：

<FlowDemo name="extension" fullscreen />

<<< @/examples/demos/extension.ts#use

### 属性编辑器

编辑器是一个函数，拿到上下文，返回放进属性面板的元素，值或只读状态变化时设计器调用 `update`：

<<< @/examples/demos/extension.ts#editor

- 上下文里有当前值、属性描述、全部被编辑的对象与是否只读。`setValue` 写入新值，`undefined` 表示清除；`commit` 表示一次编辑结束，之后的写入另起一步撤销。
- `editors` 有三张表：`byControl` 按编辑方式的种类，`byPath` 按属性路径，`byTarget` 按对象种类再按属性路径。对象种类是节点类型，连线是 `edge`，流程定义是 `document`；路径键是 `formatJsonPath` 的写法，如 `data.approver`。
- 查找时先看 `byTarget`，再看 `byPath`，最后看 `byControl`；后面的扩展压过前面的。
- 设计器内建的编辑器（如 XiHan 工作流预设的[启动变量](./xihan-workflow#启动变量)）垫在所有扩展之下，扩展在同一张表里登记同一个键就换掉它。

### 命令

<<< @/examples/demos/extension.ts#commands

- `id` 用扩展 id 加点加名字。`placement` 写缺省出现在哪里：`toolbar`，菜单栏的 `menubar:file`、`menubar:edit`、`menubar:view`、`menubar:help`，右键菜单的 `menu:node`、`menu:edge`、`menu:blank`，选中工具条的 `selection:node`、`selection:nodes`；扩展命令排在内置命令之后，自成一组（在菜单栏里排在那张菜单收尾的一组之前）；不写时只能经快捷键或 `commandLayout` 出现。扩展还能用 `menubarMenus` 往菜单栏上加自己的菜单 `{ id, label, order? }`（`order` 写在 30–80 之间，排在「视图」与「帮助」之间），命令写 `menubar:<菜单 id>` 落进去。
- `enabled` 不写时总是可用；写了 `checked` 就是开关式命令，按钮与菜单项显示选中状态；`tone` 写 `danger` 时按危险操作的颜色显示。
- `shortcut` 写成 `['Mod', 'Shift', 'P']` 这样的键序列，`Mod` 在 macOS 上是 ⌘，其它系统是 Ctrl，画布有焦点时生效。
- `run` 与其它回调拿到的上下文里有设计器本身与此刻的文案。

### 面板

<<< @/examples/demos/extension.ts#panel

- `region` 是面板占的区：`name` 不能与外框的区（`menubar`、`toolbar`、`canvas`、`status`）、内置面板（`FLOW_PANELS` 里的物料、流程结构、属性、问题、历史记录与小地图）或别的扩展的重名；`position` 是 `start`、`end`、`bottom` 之一，即左栏、右栏、下栏，同一栏的面板上下排列。
- 写了 `title` 才画成卡片：面板头写标题，带收起、「更多」（换栏、调序、浮出、收成标题条、隐藏）与关闭钮，按住面板头能拖到别处；`icon` 用在工具栏「面板」菜单与浮出小窗的标题栏，`help` 是面板头的说明，`defaultHidden` 缺省不显示。卡片的做法见 XiHan.UI 的[面板卡片](https://ui.docs.xihanfun.com/runtime/designer-shell#面板卡片)。
- `create` 在给 `extensions` 赋值、装上这个扩展时调用一次；之后设计器每次更新都调用 `update`，扩展被换下前调用 `destroy`。
- 扩展面板与内置面板一样进布局：能换栏、浮出、收起与隐藏，记在设置的 `layout.panels` 里；每块各有一条开关命令 `panel:<区名>`。

### 物料来源

`paletteSources` 往物料面板里加几组条目，接在节点类型的分组后面，适合放常用片段、行业模板这类「一点就放下一段」的物料：

<<< @/examples/snippets/palette-sources.ts#palette-sources

- `groups` 在设计器每次更新时现取，返回几组物料；条目的写法同 designer-shell 的物料面板（`label`、`icon`、`description`、`disabled`、`children` 等），内容与上一次一样时面板不重排。组 id 与条目 id（含下级）在整个物料面板里不能重名，节点类型的条目 id 就是类型名；重名时抛 TypeError。
- 条目被点按或回车时调用 `insert`，不带落点；拖进画布松手时带上松手处的世界坐标。放什么、放在哪由来源自己定，常用的是 `designer.paste(片段, { at })`：片段整体的中心放到 `at`，左上角吸附网格；点按时没有落点，取 `getViewportCenter()` 放在视口中央。
- `order` 排各来源的先后，不写按 100。只读时物料面板的条目一概不能用。

### 导入与导出

`importers` 把粘贴、拖进画布的外部内容与打开的文件换成流程内容，`exporters` 把当前流程定义换成文件：

<<< @/examples/snippets/import-export.ts#importers

- 来源有三处：粘贴（`kind` 为 `clipboard`）、拖进画布（`drop`）与 `openFile()` 选的文件（`file`）。粘贴与拖放先列文件，再按链接、HTML、纯文本列出文本；来源按先后、导入器按扩展顺序问 `accepts`，第一个接下的导入。设计器自己复制出的内容直接粘贴，不经过导入器。
- `import` 可以是异步的，返回 `{ nodes, edges }` 片段或 `{ document }` 整份流程定义，返回 `undefined` 时什么都不放。片段整体挪到落点（粘贴与打开文件时是视口中央，拖放时是指针处），左上角吸附网格，按粘贴的规则换新 id、选中并记一步撤销；整份定义换掉当前定义，同样记一步撤销，视口随后适配。
- `import` 抛错，或结果的结构不合法、id 重复、用了没登记的节点类型时，派发 `import-error`，`detail` 里是导入器的 id、来源与错误，什么都不放；打开的文件没有导入器接下时也派发，此时没有导入器的 id。
- 装了导入器后，工具栏最前面多出「打开文件」；宿主也可以自己调 `openFile()`。只读时导入一概不接。
- `fileTypes` 写这个导入器认的文件类型（`.json` 这样的扩展名或 MIME），「打开文件」的文件框按各导入器写的合起来筛选；都没写时不限类型。它只管文件框里列哪些文件，接不接仍由 `accepts` 定。
- `export(format, options)` 交给登记了这种格式的第一个导出器，`options` 原样放进上下文；得到的文件内容或文本存到哪里由宿主定。没有导出器认这种格式时返回被拒的 Promise（`RangeError`）。设计器自带一个图片导出器，认 `svg` 与 `png`，排在扩展的导出器之前（见[设计器的导出图片](./designer#导出图片)）。

<<< @/examples/snippets/import-export.ts#export

### 引导步骤

`tourSteps` 往新手引导里加几步，与通用步骤、流程自己的两步一起按 `order` 排：通用步骤是 0–60 与收尾的设置（900），流程的是 100 起，扩展的写 200 起。

<<< @/examples/snippets/tour-steps.ts#tour-steps

- `id` 用扩展 id 加点加名字；不能与别的步骤重名，也不能用留给 designer-shell 的 `shell.` 前缀，否则给 `extensions` 赋值就抛 `DesignerExtensionError`。
- `target` 指要高亮的目标：`{ panel }` 一块面板，`{ command }` 工具栏上的一条命令，`{ region }` 外框的区，`{ selector }` 设计器里的任意节点；不给就居中显示。目标看不见的那步自动跳过。
- `title`、`description` 可以是按上下文现算的函数，跟着语言变。

### 关于

`about` 是设置「关于」页里的几行 `{ label, value }`，接在设计器自己的版本与许可证后面，适合写附加包的版本与授权；上面的示例里就写了一行。

### setup

`setup` 在设计器连上文档时调用，返回的函数在断开或扩展被换下时调用，适合加监听、开定时器这类要清理的事：

<<< @/examples/demos/extension.ts#extension

## 冲突

节点类型、属性路径、编辑方式、命令 id、快捷键、面板的区名、物料来源 id、导入器或导出器的 id、设置分区 id、引导步骤 id、扩展 id 在两个扩展里重复时，给 `extensions` 赋值当场抛 `DesignerExtensionError`（从 `@xihan-ui/designer-kit` 导入），元素保持原来的扩展。错误上带冲突的名字空间、名字与两个扩展的 id：

<<< @/examples/snippets/conflict.ts#conflict
