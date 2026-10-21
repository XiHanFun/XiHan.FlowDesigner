来源：https://flow.docs.xihanfun.com/reference/schema

# 流程定义类型

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

流程定义（`FlowDocument`）是纯 JSON，下面的类型取自 `@xihan-flow/core` 的源码。当前的版本号 `FLOW_DOCUMENT_VERSION` 是 `1`，读入版本不符的定义报 `document.unsupported-version`。怎么读入与校验见[流程定义结构](../guide/schema)。

## 文档

### FlowDocument {#flowdocument}

流程图文档；数组顺序即绘制层级，靠后的在上层。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `version` | `typeof FLOW_DOCUMENT_VERSION` | 版本号，读入时与 FLOW_DOCUMENT_VERSION 比对。 |
| `nodes` | `readonly FlowNode[]` | 节点。 |
| `edges` | `readonly FlowEdge[]` | 连线。 |
| `data?` | `JsonObject` | 文档级业务数据。 |
| `extensions?` | `JsonObject` | 各扩展自己的数据，键是扩展 id。 |

### createDocument() {#createdocument}

```ts
declare function createDocument(data?: JsonObject): FlowDocument
```

创建空文档。

## 节点与连线

### FlowNode {#flownode}

节点：左上角坐标、尺寸、可选标签与业务数据。

继承 `FlowRect`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 节点 id，在文档内唯一，连线经它指向节点。 |
| `type` | `string` | 节点类型，对应登记表中的类型名。 |
| `label?` | `string` | 节点上显示的文字。 |
| `data?` | `JsonObject` | 业务数据，有哪些字段由节点类型的属性描述决定。 |
| `extensions?` | `JsonObject` | 各扩展自己的数据，键是扩展 id，每一块是 JSON 对象；与业务数据 data 分开。 |

### FlowEdge {#flowedge}

连线：起止端点、标签、外观、业务数据与可选折点。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 连线 id，在文档内唯一。 |
| `source` | `FlowEndpoint` | 起点。 |
| `target` | `FlowEndpoint` | 终点。 |
| `label?` | `string` | 连线上显示的文字。 |
| `style?` | `FlowEdgeStyle` | 外观。 |
| `data?` | `JsonObject` | 业务数据，有哪些字段由连线属性描述决定。 |
| `vertices?` | `readonly FlowPoint[]` | 途经折点，按从起点到终点的顺序排列。 |
| `extensions?` | `JsonObject` | 各扩展自己的数据，键是扩展 id。 |

### FlowEndpoint {#flowendpoint}

连线端点：节点与可选端口。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `node` | `string` | 节点 id。 |
| `port?` | `string` | 端口 id；不写时取节点类型里第一个允许这一端的端口。 |

### FlowEdgeStyle {#flowedgestyle}

连线外观。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `dashed?` | `boolean` | 画成虚线。 |

## 几何

### FlowPoint {#flowpoint}

世界坐标系中的点。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `x` | `number` | 横坐标，向右为正。 |
| `y` | `number` | 纵坐标，向下为正。 |

### FlowSize {#flowsize}

尺寸。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `width` | `number` |  |
| `height` | `number` |  |

### FlowRect {#flowrect}

轴对齐矩形。

继承 `FlowPoint`、`FlowSize`。
