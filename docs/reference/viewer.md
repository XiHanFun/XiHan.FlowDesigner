# 查看器

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`<xh-flow-viewer>` 在业务页面里显示流程与运行状态，类在 `@xihan-flow/runtime` 里导出为 `XhFlowViewer`，调用 `defineFlowViewer()` 注册。用法见[查看器](../guide/viewer)。

## 元素 xh-flow-viewer

### 属性

| 属性 | attribute | 类型 | 说明 |
| --- | --- | --- | --- |
| `schema` | — | `FlowDocument \| undefined` | 要显示的流程定义；从无到有时重新自动适配。 |
| `extensions` | — | `readonly FlowRuntimeExtension[] \| undefined` | 扩展：节点类型、节点渲染等都从这里来，内置扩展自动排在最前。赋值时当场合并查重，冲突抛 DesignerExtensionError、属性保持原值；同一个扩展对象换了引用当作卸下再装上，宿主要保持引用稳定。 |
| `statuses` | — | `Readonly<Record<string, FlowNodeStatus \| null>> \| undefined` | 节点 id → 运行状态；null 表示没有状态。 |
| `highlighted` | — | `readonly string[] \| undefined` | 高亮的节点 id。 |
| `router` | — | `FlowEdgeRouter \| undefined` | 连线路由器，缺省为直角路由。 |
| `translations` | — | `Partial<FlowViewerTranslations> \| undefined` | 元素自己的文案，压在全局配置之上。 |

### 方法

| 方法 | 说明 |
| --- | --- |
| `export(format: FlowImageFormat, options?: FlowImageExportOptions): Promise<Blob>` | 把画面上的流程图导出成图片：svg 是能单独打开的 SVG 文件，png 按倍率栅格化；颜色与字体取画面此刻的样式，节点、图标、连线与标签都画进去。选项见 FlowImageExportOptions。流程图是空的、format 不是这两种时以 RangeError 拒绝。 |
| `getViewport(): Viewport` | 当前视口。 |
| `setViewport(viewport: Viewport): void` | 设置视口；此后尺寸变化不再自动适配。 |
| `zoomToFit(): void` | 缩放并平移到让整张图落在视口中央，小图不放大到 100% 以上；此后尺寸变化时重新适配，直到设置视口或在画布上按下指针。 |
| `zoomIn(): void` | 以视口中心放大一档。 |
| `zoomOut(): void` | 以视口中心缩小一档。 |
| `zoomToActual(): void` | 缩放到 100% 并把整张图居中。 |
| `scrollToNode(id: string): void` | 把节点居中显示。 |
| `revealNode(id: string): void` | 节点没整个落在视口内时把它居中，已在视口内则不动。 |
| `setNodeStatus(id: string, status: FlowNodeStatus \| null): void` | 设置单个节点的运行状态，传 null 清除。 |
| `setNodeStatuses(statuses: Readonly<Record<string, FlowNodeStatus \| null>>): void` | 批量设置节点运行状态，未列出的节点保持不变。 |
| `highlightNodes(ids: readonly string[]): void` | 高亮一组节点，其余节点取消高亮。 |
| `clearHighlights(): void` | 清除全部高亮。 |

### 事件

事件都是冒泡的 `CustomEvent`。

| 事件 | detail | 说明 |
| --- | --- | --- |
| `node-click` | `{ id: string }` | 点了节点；拖动平移之后松手不算点击。 |
| `edge-click` | `{ id: string }` | 点了连线或连线标签。 |
| `blank-click` | `Record<string, never>` | 点了画布空白处。 |
| `node-contextmenu` | `{ id: string, x: number, y: number }` | 在节点上打开右键菜单；可以取消，取消后浏览器的右键菜单也不出现。 |
| `edge-contextmenu` | `{ id: string, x: number, y: number }` | 在连线上打开右键菜单；可以取消。 |
| `blank-contextmenu` | `{ x: number, y: number }` | 在画布空白处打开右键菜单；可以取消。 |
| `viewport-change` | `{ viewport: Viewport }` | 视口变了：缩放、平移、适配与 setViewport 都会派发。 |

## 注册

### defineFlowViewer() {#defineflowviewer}

```ts
declare function defineFlowViewer(): void
```

注册 &lt;xh-flow-viewer&gt; 与内置节点渲染用到的 &lt;xh-icon&gt;；重复调用不报错。

## 节点渲染

### FlowNodeRenderer {#flownoderenderer}

```ts
type FlowNodeRenderer = (container: HTMLElement, context: FlowNodeRenderContext) => void
```

自定义节点内容：每次绘制都会调用，把内容写进 container；不给时用 defaultNodeRenderer。

### FlowNodeRenderContext {#flownoderendercontext}

自定义节点内容时拿到的上下文。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `node` | `FlowNode` | 要画的节点。 |
| `nodeType` | `FlowNodeType \| undefined` | 节点类型；类型没有登记时为 undefined。 |
| `label` | `string` | 要显示的文字：节点的 label，没有时取节点类型的名称，再没有取节点 id。 |
| `status` | `FlowNodeStatus \| undefined` | 节点此刻的运行状态；没有状态时为 undefined。 |
| `highlighted` | `boolean` | 节点是否高亮。 |

### defaultNodeRenderer() {#defaultnoderenderer}

```ts
declare function defaultNodeRenderer(container: HTMLElement, { nodeType, label }: FlowNodeRenderContext): void
```

内置的节点内容：节点类型给了 icon 时图标（data-part="node-icon"）在前、文字（data-part="node-label"）在后，没给时节点里只有文字。没有登记渲染的节点类型用它，自定义的渲染也可以调它画出同样的内容。重画时复用已有的图标与文字节点。图标是 &lt;xh-icon&gt;，defineFlowViewer() 与 defineFlowDesigner() 会注册它。

### FlowRuntimeExtension {#flowruntimeextension}

流程运行时层的扩展：在 core 层之上加节点内容的渲染，查看器与设计器都读它。

继承 `FlowCoreExtension`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodeRenderers?` | `Readonly<Record<string, FlowNodeRenderer>>` | 节点内容的渲染，键是节点类型；没给渲染的类型用 defaultNodeRenderer 画图标与文字。 |

### createFlowRuntimeModel() {#createflowruntimemodel}

```ts
declare function createFlowRuntimeModel(extensions?: readonly FlowRuntimeExtension[]): FlowRuntimeModel
```

合出运行时用的流程模型；同一节点类型在两个扩展里都给了渲染时抛 DesignerExtensionError。同一个数组只合一次。

## 导出图片

### FlowImageFormat {#flowimageformat}

```ts
type FlowImageFormat = 'svg' | 'png'
```

导出图片的格式。

### FlowImageExportOptions {#flowimageexportoptions}

导出图片的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `scale?` | `number` | 倍率，只对 PNG 有效：PNG 的像素宽高是图的宽高乘它，缺省 1；超过浏览器画布的上限时自动降倍率，图按比例缩小。 |
| `background?` | `string` | 底色，任何 CSS 颜色；缺省取画布此刻的底色（画布透明时往外找到第一层不透明的），写 'transparent' 不铺。 |
| `padding?` | `number` | 流程图四周的留白，缺省 24。 |

### exportFlowImage() {#exportflowimage}

```ts
declare function exportFlowImage(source: FlowImageSource, format: FlowImageFormat, options?: FlowImageExportOptions): Promise<Blob>
```

导出成图片：SVG 是 flowImageSvg 的文本，PNG 在它上面按倍率栅格化（底色已画进 SVG），超过画布上限时按比例缩小。PNG 里的文字用本机的系统字体画，不加载网页字体。

### flowImageSvg() {#flowimagesvg}

```ts
declare function flowImageSvg(source: FlowImageSource, options?: FlowImageExportOptions): SVGSVGElement
```

把画面上的流程图画成一份能单独打开的 SVG：连线层经 standaloneSvg 克隆（只供命中的透明粗线不要，克隆根上的表现属性挪到放连线的组上），节点按计算样式画成框、图标与文字，连线标签画成底框与文字；四周留白，按选项铺底色。颜色写成 sRGB 的 #rrggbb，透明度写进 fill-opacity / stroke-opacity；画布的字体写在根上，文字只写与它不同的那几项。坐标是世界坐标，1 个单位即 1 像素。流程图是空的时抛 RangeError。

### FlowImageSource {#flowimagesource}

画出图片要读的活元素：场景、画布上的连线层、节点与连线标签的元素，以及视口的缩放。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `scene` | `FlowScene` |  |
| `canvas` | `Element` | 画布元素：缺省底色从它开始找。 |
| `edges` | `SVGSVGElement` | 连线所在的 SVG 层，里面的坐标是世界坐标。 |
| `zoom` | `number` | 视口的缩放：元素在屏幕上的尺寸除以它即世界尺寸。 |

| 方法 | 说明 |
| --- | --- |
| `node(id: string): HTMLElement \| null` | 节点 id → 画面上的节点元素。 |
| `label(id: string): HTMLElement \| null` | 连线 id → 画面上的连线标签元素。 |

## 连线路由

### createOrthogonalRouter() {#createorthogonalrouter}

```ts
declare function createOrthogonalRouter(options?: OrthogonalRouterOptions): FlowEdgeRouter
```

创建直角路由器；找不到绕开全部节点的通路时，返回不看障碍物的直角折线。

### OrthogonalRouterOptions {#orthogonalrouteroptions}

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `margin?` | `number` | 与节点保持的距离，也是从端口引出的长度，缺省 16。 |
| `bendCost?` | `number` | 每个拐弯折合的长度，缺省 margin 的两倍。 |

## 文案

### FlowViewerTranslations {#flowviewertranslations}

查看器的文案。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `label` | `string` | 视口区域的可访问名。 |

## 语言包

### locale/de-DE

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowDeDE` | 常量 | 流程的德语文案：查看器、设计器与 designer-shell 零件。 |

### locale/en-US

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowEnUS` | 常量 | 流程的英文文案：查看器、设计器与 designer-shell 零件。 |

### locale/es-ES

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowEsES` | 常量 | 流程的西班牙语文案：查看器、设计器与 designer-shell 零件。 |

### locale/fr-FR

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowFrFR` | 常量 | 流程的法语文案：查看器、设计器与 designer-shell 零件。 |

### locale/ja-JP

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowJaJP` | 常量 | 流程的日语文案：查看器、设计器与 designer-shell 零件。 |

### locale/ko-KR

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowKoKR` | 常量 | 流程的韩语文案：查看器、设计器与 designer-shell 零件。 |

### locale/pt-BR

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowPtBR` | 常量 | 流程的巴西葡萄牙语文案：查看器、设计器与 designer-shell 零件。 |

### locale/ru-RU

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowRuRU` | 常量 | 流程的俄语文案：查看器、设计器与 designer-shell 零件。 |

### locale/types

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FlowLocale` | 接口 | 流程一种语言的全部文案。 |

### locale/zh-CN

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowZhCN` | 常量 | 流程的简体中文文案：查看器、设计器与 designer-shell 零件。 |

### locale/zh-TW

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `flowZhTW` | 常量 | 流程的繁体中文文案：查看器、设计器与 designer-shell 零件。 |

## 全部导出

### designer-locale

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `DEFAULT_FLOW_DESIGNER_TRANSLATIONS` | 常量 | 设计器不配语言包时的缺省文案。 |
| `FLOW_DESIGNER_EN_US` | 常量 | 设计器的英文文案，也是不配语言包时的缺省。 |
| `FlowBuiltinPropertyKey` | 类型 | 设计器内建的属性路径，formatJsonPath 的写法。 |
| `FlowDesignerLocale` | 接口 | 一种语言的设计器文案：问题说明与内建属性名写成表，其余与 FlowDesignerTranslations 相同。 |
| `flowDesignerTranslations` | 函数 | 把一种语言的设计器文案换成设计器读的形状：问题按码查表，表里没有的（扩展的问题码）显示问题码。 |
| `FlowIssueMessage` | 类型 | 一条问题说明：text 取参数的文字，type 取参数里那个节点类型的显示名。 |

### extensions

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFlowRuntimeModel` | 函数 | 合出运行时用的流程模型；同一节点类型在两个扩展里都给了渲染时抛 DesignerExtensionError。 |
| `FlowRuntimeExtension` | 接口 | 流程运行时层的扩展：在 core 层之上加节点内容的渲染，查看器与设计器都读它。 |
| `FlowRuntimeModel` | 接口 | 运行时用的流程模型：core 的模型加上各节点类型的渲染。 |

### flow-viewer

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `defineFlowViewer` | 函数 | 注册 &lt;xh-flow-viewer&gt; 与内置节点渲染用到的 &lt;xh-icon&gt;；重复调用不报错。 |
| `FLOW_VIEWER_TAG` | 常量 | 查看器的标签名。 |
| `FlowNodeRenderContext` | 接口 | 自定义节点内容时拿到的上下文。 |
| `FlowNodeRenderer` | 类型 | 自定义节点内容：每次绘制都会调用，把内容写进 container；不给时用 defaultNodeRenderer。 |
| `FlowViewerEventMap` | 接口 | 查看器派发的事件；x / y 为浏览器视口坐标。 |
| `XhFlowViewer` | 类 | 流程查看器 &lt;xh-flow-viewer&gt;：只读显示流程、运行状态与高亮。 |

### image-export

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `exportFlowImage` | 函数 | 导出成图片：SVG 是 flowImageSvg 的文本，PNG 在它上面按倍率栅格化（底色已画进 SVG），超过画布上限时按比例缩小。 |
| `FlowImageExportOptions` | 接口 | 导出图片的选项。 |
| `FlowImageFormat` | 类型 | 导出图片的格式。 |
| `FlowImageSource` | 接口 | 画出图片要读的活元素：场景、画布上的连线层、节点与连线标签的元素，以及视口的缩放。 |
| `flowImageSvg` | 函数 | 把画面上的流程图画成一份能单独打开的 SVG：连线层经 standaloneSvg 克隆（只供命中的透明粗线不要，克隆根上的表现属性挪到放连线的组上），节点按计算样式画成框、图标与文字，连线标签画成底框与文字；四周留白，按选项铺底色。 |

### node-renderer

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `defaultNodeRenderer` | 函数 | 内置的节点内容：节点类型给了 icon 时图标（data-part="node-icon"）在前、文字（data-part="node-label"）在后，没给时节点里只有文字。 |

### router

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createOrthogonalRouter` | 函数 | 创建直角路由器；找不到绕开全部节点的通路时，返回不看障碍物的直角折线。 |
| `OrthogonalRouterOptions` | 接口 |  |

### scene

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `buildScene` | 函数 | 算出整张图的场景。 |
| `FlowNodeStatus` | 类型 | 节点运行状态；内置样式覆盖 running / completed / faulted / waiting / canceled / compensated，其余取值由使用方自行着色。 |
| `FlowScene` | 接口 |  |
| `FlowSceneEdge` | 接口 |  |
| `FlowSceneNode` | 接口 |  |
| `FlowSceneOptions` | 接口 |  |

### translations

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `DEFAULT_FLOW_VIEWER_TRANSLATIONS` | 常量 | 查看器的英文文案，也是不配语言包时的缺省。 |
| `FlowDesignerTranslations` | 接口 | 设计器的文案。 |
| `FlowIssueNames` | 接口 | 拼问题说明时用到的名称。 |
| `FlowStartVariableColumn` | 类型 | 启动变量表的列：变量名、必填、缺省值、说明。 |
| `FlowViewerTranslations` | 接口 | 查看器的文案。 |
