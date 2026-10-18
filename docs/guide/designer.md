# 设计器

`<xh-flow-designer>` 编辑流程定义：从物料面板拖入节点、拖动端口连线、在属性面板里改属性，问题列表随时给出校验结果；撤销重做、剪贴板、对齐分布与自动布局都是内置命令。它只改流程定义，不保存，什么时候存、存到哪里由宿主决定。完整的属性、方法、事件与命令见[设计器参考](../reference/designer)。

## 放上页面

调用 `defineFlowDesigner()` 注册设计器，它用到的 XiHan.UI 元素与设计器零件一并注册。样式表比查看器多两份：设计器零件的 `@xihan-ui/designer-shell/style.css` 与设计器自己的 `@xihan-flow/designer/style.css`。

<<< @/examples/demos/designer.ts#register

再把扩展与流程定义交给 `extensions` 与 `schema`。设计器铺满自身，宿主要给元素定高度。

<<< @/examples/demos/designer.ts#setup

<FlowDemo name="designer" />

- `extensions` 与查看器的是同一类扩展，设计器层的扩展还能登记属性编辑器、命令与面板，见[扩展](./extensions)。同一个扩展对象换了引用会当作卸下再装上，宿主要保持引用稳定。
- 给 `schema` 赋值即装载：清空撤销历史与选择，重新适配视口。赋回当前这一份不会重新装载。
- 读 `schema` 得到当前的流程定义。设计器从不改动传进来的对象，每次修改都产生一份新的定义。

## 编辑

**新建节点**：把物料面板里的节点类型拖到画布上，在松手处新建；点条目则在视口中央新建。物料按节点类型的类别分组，`paletteGroupOrder` 定类别的先后，`paletteGroupLabels` 给类别换显示文字。宿主也可以调用 `addNode(type, at)`。

**选择**：点节点或连线选中它，按住 Shift、Ctrl 或 ⌘ 点击则加选或取消；在空白处按住 Shift 拖出框选，同时按住 Ctrl 或 ⌘ 时追加到已有的选择上；点空白处清空选择。选择变化派发 `selection-change`，`getSelection()` 与 `select()` 读写选择。

**移动**：拖动选中的节点。`grid` 是吸附的网格边长，缺省 16，写 `false` 不吸附；`snap` 开着时靠近其它节点会吸附并显示对齐线。按住 Alt 松手时原节点不动，在新位置复制一份。画布有焦点时方向键微移选中的节点，按住 Shift 一次移一格网格。

**连线**：从节点的端口拖到另一个节点的端口。拖动途中预览线标出能不能连；违反节点类型的连接约束时连不上，派发 `connect-reject`，`detail` 里是两端与全部问题。选中连线后，两端的控制柄拖到别的端口即改连；中段的控制柄拖出拐点，拐点可以拖动，双击去掉；「清除拐点」把连线交回自动路由。拖动途中按 Escape 取消。

**平移与缩放**与查看器一样：在空白处拖动或滚动滚轮平移，按住 Ctrl 或 ⌘ 滚动滚轮缩放；没有选中节点时方向键平移视口。小地图上按下或拖动，视口中心移到那里。

## 属性面板

属性面板编辑选中的对象：节点按节点类型的属性描述列出字段；连线列出连线通用的属性，再加上源节点类型给出线登记的属性。选中多个对象时只编辑它们共同的属性，一次写进全部对象；什么都没选中时编辑流程定义级的属性。

字段按属性描述的分组排列。`propertyGroupOrder` 定分组的先后，`propertyGroupLabels` 给分组换标题；示例里两项都来自预设的中文文案。在同一个字段里连续输入合成一步撤销，离开字段后再改另起一步。字段的校验问题直接显示在字段上。

## 问题列表

流程定义、扩展或校验选项变了之后，设计器重新校验，问题列表显示全部问题，同时派发 `issues-change`。错误与警告的条数在问题列表的面板头上，点一下只看或不看这一级。有问题的节点带 `data-issue`，取值是落在它上面最严重的一级（`error` 或 `warning`），皮肤据此画出标记。点一条问题，设计器选中问题所在的节点或连线并显露它；问题落在某个属性上时，焦点直接交给属性面板里的那个字段。

问题码与说明见[问题码](../reference/issues)。`validateOptions` 按问题码改写严重程度，写 `off` 即不报告：

<<< @/examples/snippets/designer-layout.ts#severity

`validate()` 按同样的扩展与选项立即校验一次，宿主保存前可以用它拦下有错误的定义。

## 命令

工具栏、右键菜单与快捷键执行的都是命令。内置命令的 id、名称与快捷键见[内置命令](../reference/designer#内置命令)；只读时会修改流程定义的命令不可用，复制、全选与缩放仍可用。命令都有对应的方法，宿主的按钮直接调用方法即可，比如 `undo()`、`duplicate()`、`align('left')`、`autoLayout({ direction: 'LR' })`。

右键菜单按落点给出不同的命令：节点上是复制、剪切、删除与创建副本，选中两个以上节点时加上对齐，三个以上时再加上分布；连线上是删除与清除拐点；空白处是粘贴、全选、自动布局与适配。在画布上按 ContextMenu 键或 Shift + F10，按当前的选择打开菜单。右键事件可以取消，取消后内置菜单与浏览器的菜单都不出现，宿主可以在 `detail` 的 `x`、`y` 处弹自己的菜单。

`commandLayout` 重排工具栏与各右键菜单，键是位置（`toolbar`、`menu:node`、`menu:edge`、`menu:blank`），值是若干组命令 id。写了某个位置就只显示列出的命令，没写的位置用内置排列；排列里写了不存在的命令 id 会抛 TypeError，不会静默跳过。

<<< @/examples/snippets/designer-layout.ts#command-layout

`panels` 决定显示哪些面板，空格分隔 `toolbar`、`palette`、`properties`、`issues`、`minimap`。不写即全部显示，写空串全部收起；同名 attribute 也认。

<<< @/examples/snippets/designer-layout.ts#panels

物料、属性与问题列表各是一张卡片：面板头写标题，属性面板的副标题是当前编辑的对象，「?」弹出这块面板的说明，「×」收起它。收起后设计器改写 `panels` 并派发 `panels-change`，`detail.panels` 是之后要显示的面板，宿主存下来、下次赋回即可。

除了命令的快捷键，画布有焦点时还认这些键：Ctrl / ⌘ + Y 重做，Backspace 删除，`=` 放大。Ctrl / ⌘ + C、X、V 走系统剪贴板：复制出的是一段 JSON 文本，能在同一页面、别的页面或别的标签页的设计器里粘贴；读不出流程内容的文本交给扩展的导入器（见[导入与导出](./extensions#导入与导出)），没有导入器接下时不会贴进来。

## 撤销与保存

每次修改记为一步撤销，拖动这类连续操作松手时才记为一步。`canUndo`、`canRedo` 表示能不能撤销重做，`undo()`、`redo()` 执行。宿主自己改流程定义时用 `execute(operations)`，一组操作记为一步，操作的写法见[流程定义结构](./schema#编辑操作)。

流程定义每次变化派发 `schema-change`，`detail` 里是新的定义、这次的操作与种类：`execute` 是编辑，`undo`、`redo` 是撤销重做，`load` 是装载了新定义。

<<< @/examples/demos/designer.ts#change

`dirty` 表示有没有未保存的修改，变化时派发 `dirty-change`。设计器不自己保存：画布有焦点时按 Ctrl / ⌘ + S 只派发 `save`，宿主保存成功后调用 `markSaved()` 把当前状态记为已保存。撤销回已保存的那一步时 `dirty` 也会回到 `false`。

<<< @/examples/demos/designer.ts#save

## 导出图片

`export("svg" | "png", options)` 与查看器的导出图片相同，选项也一样；选中的节点与连线按没选中的样子画。它是设计器自带的图片导出器，与扩展登记的导出器走同一个 `export()`。

工具栏最后一组是「导出 PNG」与「导出 SVG」，流程图是空的时不可用，只读时照样能用。导出后派发可以取消的 `export` 事件，`detail` 里是格式与文件；没被取消时存成 `flow.png` 或 `flow.svg` 下载，宿主想自己命名或上传就取消它，拿 `detail.blob` 自己存。不想要这两个按钮时用 `commandLayout` 把它们去掉。

## 只读

`readonly` 打开后仍可以选择、浏览、复制与缩放，不能修改：拖动、连线、删除、粘贴与属性面板的编辑都不起作用，会修改的方法什么都不做。元素上带 `data-readonly`。

同名 attribute 是三态的，与 XiHan.UI 的元素一致：不写为缺省（不只读）；写 `readonly="false"` 为 `false`；写 `readonly`、`readonly="true"` 或别的值为 `true`；摘掉 attribute 回到缺省。这是行为变化：以前只要写了这个 attribute 就算只读，`readonly="false"` 也不例外。经 property 赋值不受影响。

<<< @/examples/demos/designer.ts#readonly

## 文案

设计器的缺省文案是英文。全站换语言时与查看器一样合并同一语言的流程语言包（如 `flowZhCN`、`flowJaJP`），写法见[快速开始](../quickstart#中文界面)。单个实例要改时写 `translations`，它压在全局配置之上；可以改的文案见 [FlowDesignerTranslations](../reference/designer#flowdesignertranslations)。
