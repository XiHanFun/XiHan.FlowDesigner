来源：https://flow.docs.xihanfun.com/guide/schema

# 流程定义结构

流程定义（`FlowDocument`）是纯 JSON：一组节点、一组连线，加上文档级的业务数据。它不含也不执行任何代码，可以原样存进数据库、文件或交给接口。各字段的完整类型见[流程定义类型](../reference/schema)。

## 文档

```json
{
  "version": 1,
  "nodes": [],
  "edges": [],
  "data": { "code": "expense", "name": "费用审批" }
}
```

- `version` 是定义的版本号，读入时与 `FLOW_DOCUMENT_VERSION` 比对。
- `nodes` 与 `edges` 的数组顺序就是绘制层级，靠后的画在上层。
- `data` 是文档级的业务数据，比如流程编码与名称；有哪些字段由扩展登记的流程定义级属性决定，设计器里没选中任何对象时属性面板编辑的就是它们。
- `extensions` 放各扩展自己的数据，键是扩展 id，与业务数据分开（见下文）。

`createDocument(data?)` 返回一份空的流程定义。

## 节点

```json
{
  "id": "dept",
  "type": "UserTask",
  "x": 176,
  "y": 100,
  "width": 160,
  "height": 48,
  "label": "部门经理审批",
  "data": { "properties": { "Assignees": ["部门经理"], "CompletionPolicy": "Any" } }
}
```

- `id` 在文档内唯一，连线经它指向节点。
- `type` 是节点类型名，必须是扩展登记过的类型，否则校验报 `node.unknown-type`。节点类型决定节点的外观、端口、能连向哪里，以及 `data` 里有哪些属性。
- `x`、`y` 是节点左上角的坐标，`width`、`height` 是尺寸，单位都是像素；坐标原点在画布左上角，向右、向下为正。
- `label` 是节点上显示的文字。
- `data` 是业务数据，由节点类型的属性描述决定字段；设计器的属性面板按属性描述编辑它。

## 连线

```json
{
  "id": "large",
  "source": { "node": "amount" },
  "target": { "node": "gm" },
  "label": "金额 > 1 万",
  "data": { "condition": "amount > 10000", "priority": 0 }
}
```

- `source` 与 `target` 是起点与终点：`node` 是节点 id，`port` 是端口 id。不写 `port` 时取节点类型里第一个允许这一端的端口。
- `label` 是连线上显示的文字，`style.dashed` 画成虚线。
- `data` 是业务数据：有哪些字段由连线属性描述决定，可以随起点节点的类型不同（比如分支节点的出线才有条件与优先级）。
- `vertices` 是途经的折点，按从起点到终点的顺序排列。没写折点的连线由路由器自动求出直角折线，绕开途中的节点。

## 业务数据与扩展数据

`data` 归业务：节点类型与属性描述决定它有哪些字段，宿主据此保存、提交与执行。`extensions` 归扩展：某个扩展要在节点、连线或文档上存自己的数据时，放在 `extensions` 里以扩展 id 为键的那一块，不混进业务数据。去掉一个扩展时，它在 `extensions` 里的数据原样保留，装回来时还能读到。

## 读入与校验

从存储或接口取回的流程定义是未知输入，先交给 `readDocument`：它逐项检查字段类型、必填项与多余字段，通过时返回不与输入共享引用的副本，不通过时返回问题列表。`readDocument` 只检查结构；重复 id、悬空引用、端口约束与属性取值这类语义问题交给 `validateDocument`，它按传入的扩展检查，返回全部问题。

```ts
import { readDocument, validateDocument } from '@xihan-flow/core'
import { extensions } from '../schemas/approval'

export function load(json: string): { document: FlowDocument, errors: FlowIssue[] } {
  const read = readDocument(JSON.parse(json))
  if (!read.ok)
    throw new Error(read.issues.map(issue => `${issue.code} @ ${issue.path.join('.')}`).join('\n'))
  const issues = validateDocument(read.document, {
    extensions,
    severity: { 'node.unreachable': 'off' },
  })
  return { document: read.document, errors: issues.filter(issue => issue.severity === 'error') }
}
```

每条问题带问题码、从文档根算起的路径、所在对象与严重程度，不带文案。`severity` 按问题码改写严重程度，写 `off` 即不报告。设计器自己会随编辑重新校验，把问题列在问题列表里；全部问题码与说明见[问题码](../reference/issues)。

## 编辑操作

设计器里的每次修改都是一组纯 JSON 的编辑操作，`schema-change` 事件把它们连同新的流程定义一起交给宿主。`applyOperation` 与 `applyOperations` 在任何地方都能把操作应用到流程定义上，返回新定义与逆操作；按顺序应用逆操作就回到修改之前。删除节点时与它相连的连线一并删除，逆操作会把它们放回原位置。`replaceDocument` 整份换掉流程定义，逆操作换回原来那份；设计器的 JSON 编辑与导入整份定义都走它。

```ts
import { applyOperations } from '@xihan-flow/core'
import { schema } from '../schemas/approval'

const { document, inverse } = applyOperations(schema, [
  { type: 'updateNode', id: 'gm', patch: { label: '总经理与财务审批' } },
  { type: 'moveNodes', positions: [{ id: 'gm', x: 624, y: 0 }] },
])

// 按顺序应用逆操作，回到修改之前
const restored = applyOperations(document, inverse).document
```

操作只保证 id 唯一与被操作的对象存在；引用完整性、端口约束与属性取值仍由 `validateDocument` 负责。操作无法应用时抛 `FlowOperationError`，传入的流程定义保持不变。
