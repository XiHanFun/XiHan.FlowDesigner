来源：https://flow.docs.xihanfun.com/guide/viewer

# 查看器

`<xh-flow-viewer>` 在业务页面里显示流程：按节点类型画出节点与连线，标出每个节点的运行状态与高亮，支持缩放、平移与定位节点。它只读，不改动流程定义。完整的属性、方法与事件见[查看器参考](../reference/viewer)。

## 显示流程

调用 `defineFlowViewer()` 注册元素，再把扩展与流程定义交给 `extensions` 与 `schema` 属性，写法见[快速开始](../quickstart)。

- `extensions` 决定节点类型、端口与节点内容的渲染。没有登记的节点类型照样画成显示名称的方框，但它没有端口，连到它的连线画不出来。同一个扩展对象换了引用会当作卸下再装上，宿主要保持扩展数组与其中对象的引用稳定。
- 第一次拿到流程定义（`schema` 从无到有）时，查看器缩放并平移到整张图落在视口中央，小图不放大到 100% 以上；之后元素尺寸变化也跟着重新适配，直到调用 `setViewport` 或在画布上按下指针。
- 复杂数据走属性，不走 attribute；属性变了会自动重画。

## 运行状态

`statuses` 是节点 id 到运行状态的映射，值为 `null` 或不写表示没有状态。也可以用方法逐步更新：`setNodeStatus(id, status)` 改一个，`setNodeStatuses(map)` 改一批，没列出的节点保持不变。

皮肤为这几种状态各画了一种样子：

| 状态 | 用途 |
| --- | --- |
| `running` | 正在处理 |
| `completed` | 已完成 |
| `waiting` | 等待中 |
| `faulted` | 出错 |
| `canceled` | 已取消 |
| `compensated` | 已补偿 |

状态是任意字符串，写在节点元素的 `data-status` 上。其它取值由宿主自己加样式，只用 XiHan.UI 的设计令牌：

```css
xh-flow-viewer [data-part='node'][data-status='skipped'] {
  color: var(--xh-fg-muted);
  border-style: dashed;
}
```

节点元素上还有 `data-node-id` 与 `data-node-type`，高亮时带 `data-highlighted`。

## 高亮与定位

`highlightNodes(ids)` 高亮一组节点、取消其余的高亮，`clearHighlights()` 全部取消；`highlighted` 属性是同一份数据。`scrollToNode(id)` 把节点居中，`revealNode(id)` 只在节点没整个落在视口里时才挪动。

```ts
const highlight = button('高亮大额路径', () => viewer.highlightNodes(['start', 'dept', 'amount', 'gm', 'approved']))
const clear = button('清除高亮', () => viewer.clearHighlights())
```

```ts
const locate = button('定位到总经理审批', () => viewer.scrollToNode('gm'))
const fit = button('适配', () => viewer.zoomToFit())
```


`zoomIn`、`zoomOut`、`zoomToActual` 与 `zoomToFit` 对应工具栏上常见的四个按钮；`getViewport` 与 `setViewport` 读写视口，可以把视口存起来下次恢复。在画布上拖动或滚动滚轮平移，按住 Ctrl 或 ⌘ 滚动滚轮缩放；画布获得焦点后方向键平移，`+` 与 `-` 缩放，`0` 适配。

## 事件

点击与右键都派发事件，`detail` 里是节点或连线的 id；右键事件还带浏览器视口坐标，事件可以取消，取消后浏览器的右键菜单不出现，宿主就能在那个位置弹自己的菜单。

```ts
viewer.addEventListener('node-click', (event) => {
  const { id } = (event as FlowViewerEventMap['node-click']).detail
  const node = schema.nodes.find(item => item.id === id)
  status.textContent = `点了「${node?.label}」，类型 ${node?.type}`
})
viewer.addEventListener('node-contextmenu', (event) => {
  // 取消后浏览器的右键菜单不出现，宿主可以在 detail 的 x、y 处弹自己的菜单
  event.preventDefault()
  status.textContent = `在「${(event as FlowViewerEventMap['node-contextmenu']).detail.id}」上按了右键`
})
```

拖动平移之后松手不算点击。视口每次变化派发 `viewport-change`。

## 自定义节点内容

运行时层的扩展可以给某个节点类型登记渲染函数 `nodeRenderers`：每次绘制都会调用，把内容写进节点元素。上下文里有节点、节点类型、要显示的文字、运行状态与是否高亮。没登记渲染的类型由 `defaultNodeRenderer` 画：节点类型给了 `icon` 时图标在前、名称在后，没给时只有名称；自己的渲染函数也可以先调它画出同样的内容再加别的。渲染函数只用 DOM API 建节点，不把数据拼进 `innerHTML`。

```ts
const assignees: FlowRuntimeExtension = {
  id: 'example/assignees',
  nodeRenderers: {
    UserTask: (container, { node, label }) => {
      const properties = node.data?.properties as { Assignees?: string[] } | undefined
      const title = document.createElement('strong')
      title.textContent = label
      const people = document.createElement('small')
      people.textContent = (properties?.Assignees ?? []).join('、')
      container.replaceChildren(title, document.createElement('br'), people)
    },
  },
}
```

装进 `extensions`，与节点类型所在的扩展放在一起：

```ts
const viewer = document.createElement('xh-flow-viewer')
viewer.extensions = [workflow, assignees]
viewer.schema = schema
```


同一个节点类型在两个扩展里都登记了渲染时，赋值当场抛 `DesignerExtensionError`，属性保持原值。设计器读的也是同一份渲染，画布上看到的与查看器一致。

## 连线路由

没写折点的连线交给路由器求折线。缺省是直角路由：从端口引出、绕开途中的节点，找不到绕开全部节点的通路时退回不看障碍物的直角折线。`createOrthogonalRouter` 可以调整与节点保持的距离，也可以换成自己写的路由器，它拿到两端的锚点与要绕开的节点框，返回从起点到终点的完整折线：

```ts
viewer.router = createOrthogonalRouter({ margin: 24 })
```

```ts
const straight: FlowEdgeRouter = ({ source, target }) => [source.point, target.point]
viewer.router = straight
```

## 导出图片

`export(format, options)` 把画面上的流程图导出成图片，得到 `Blob`：`svg` 是能单独打开的 SVG 文件，`png` 在它上面栅格化。节点的框、图标与文字，连线、箭头与标签都画进去，颜色与字体取画面此刻的样式（运行状态的描边颜色也在），换成具体值写进文件，脱离页面也一样。颜色一律写成 sRGB 的 `#rrggbb`，带透明度的写进 `fill-opacity` / `stroke-opacity`，办公软件与矢量编辑器里也能打开；超出 sRGB 色域的颜色按通道裁剪。字体写在根上一次，各段文字只写与它不同的那几项。

| 选项 | 说明 |
| --- | --- |
| `scale` | 倍率，只对 PNG 有效，缺省 1；给高分屏看时写 2。图太大、超过浏览器画布的上限时自动降倍率，按比例缩小 |
| `background` | 底色，任何 CSS 颜色；缺省取画布此刻的底色（画布透明时往外找第一层不透明的），写 `transparent` 不铺 |
| `padding` | 四周的留白，缺省 24 |

```ts
const png = await viewer.export('png', { scale: 2 })
```

自定义节点内容只按节点的文字导出一行。PNG 里的文字用本机的系统字体画，不加载网页字体；SVG 文件里写的是字体名，打开它的机器上有这个字体就用它。流程图是空的时以 `RangeError` 拒绝。

## 文案

查看器只有一句给读屏的名称，缺省是英文 `Flow diagram`，中文语言包里是「流程图」。单个实例要改时写 `translations`，它压在全局配置之上。
