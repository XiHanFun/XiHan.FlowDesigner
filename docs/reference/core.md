# 模型层 core

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`@xihan-flow/core` 是纯 TypeScript 的模型层：流程定义的类型、读入检查、校验、编辑操作、连线几何、节点类型登记与扩展合并，不依赖 DOM，浏览器、Node.js 与其它 JavaScript 运行环境里都能用。流程定义的字段见[流程定义类型](./schema)，问题码见[问题码](./issues)。下表按源码模块列出全部导出。

## 全部导出

### extensions

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFlowModel` | 函数 | 合出流程模型：内置扩展 FLOW_CORE_EXTENSION 在前，extensions 按顺序在后。 |
| `FLOW_CORE_EXTENSION` | 常量 | 内置扩展：连线的标签与虚线。 |
| `FLOW_EXTENSION_SPACES` | 常量 | 流程各层扩展共用的名字空间：节点类型、连线属性路径与流程定义级属性路径。 |
| `FlowCoreExtension` | 接口 | 流程 core 层的扩展：节点类型、连线属性、流程定义级属性、编辑方式与规则。 |
| `FlowModel` | 接口 | 一组扩展合出的流程模型：节点类型、连线与流程定义级属性、编辑方式。 |
| `FlowRuleContext` | 接口 | 规则拿到的上下文：合并后的节点类型。 |
| `patchExtensionData` | 函数 | 某个扩展的数据写进对象原有的 extensions 后的新值，交给 updateNode / updateEdge / updateDocument 的 patch.extensions：别的扩展的数据原样保留；data 为 undefined 时去掉这一块，去完为空时为 null（即删掉 extensions 字段）。 |

### geometry

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `computeEdgeGeometry` | 函数 | 求全部连线的折线：带折点的连线依次穿过折点，其余交给 route；两端都以端口位置为起止。 |
| `FlowEdgeAnchor` | 接口 | 连线的一端：端口位置与离开（起点）或进入（终点）节点的那一边。 |
| `FlowEdgeGeometry` | 接口 | 一条连线的几何；端点解析不出时 points 为空、anchored 为 false。 |
| `FlowEdgeRouter` | 类型 | 路由器：给出从起点锚点到终点锚点的完整折线（含两端）。 |
| `FlowRouteRequest` | 接口 | 路由器的输入：两端锚点与要绕开的节点框。 |
| `resolveEdgeAnchor` | 函数 | 解析连线一端的锚点；节点不存在、类型未知或没有可用端口时返回 undefined。 |

### issues

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FlowEdgeEnd` | 类型 | 连线的一端。 |
| `FlowIssue` | 类型 | 一条问题：问题码、从文档根算起的路径、所在对象（节点为 { kind: 'node', id }，连线为 { kind: 'edge', id }）、严重程度与参数，不带文案。 |
| `FlowIssueCode` | 类型 | 全部问题码。 |
| `FlowSchemaIssueCode` | 类型 | 读取未知输入时的结构问题码：通用问题码之外只有版本不受支持。 |
| `FlowValidationIssueCode` | 类型 | 按节点类型登记表校验文档时的问题码；required 与取值问题码来自节点属性检查。 |

### operations

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `applyOperation` | 函数 | 应用一个编辑操作，返回新文档与逆操作，不修改输入文档；未改动的节点与连线沿用原引用。 |
| `applyOperations` | 函数 | 依次应用一组操作；逆操作为各操作逆操作按反序拼接。 |
| `FlowDocumentPatch` | 接口 | 文档字段补丁：缺省表示不变，null 表示删除该字段。 |
| `FlowEdgePatch` | 接口 | 连线字段补丁：缺省表示不变，null 表示删除该字段。 |
| `FlowNodePatch` | 接口 | 节点字段补丁：缺省表示不变，null 表示删除该字段。 |
| `FlowNodePosition` | 接口 | 节点的新位置。 |
| `FlowOperation` | 类型 | 编辑操作；所有操作都是纯 JSON。 |
| `FlowOperationError` | 类 | 操作无法应用时抛出的错误；文档保持不变。 |
| `FlowOperationErrorCode` | 类型 | 操作失败原因。 |
| `FlowOperationResult` | 接口 | 应用操作的结果：新文档与按顺序应用即可撤销的逆操作；没有带来变化时文档是传入的同一引用、逆操作为空。 |
| `FlowOperationType` | 类型 | 操作类型名。 |

### read

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FlowReadResult` | 类型 | 读取结果：成功时给出规范化后的文档副本，失败时给出全部结构问题。 |
| `readDocument` | 函数 | 把未知输入读成文档：逐项检查字段类型、必填项与多余字段，返回不与输入共享引用的副本。 |

### registry

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createNode` | 函数 | 按节点类型新建节点：尺寸、标签与 data 取类型默认值，init 中给出的字段优先；再把属性描述的缺省值写进还没有值的路径。 |
| `createNodeTypeRegistry` | 函数 | 创建节点类型登记表；定义不合法时抛错。 |
| `findPort` | 函数 | 查找节点类型上的端口。 |
| `FlowConnectionRule` | 接口 | 连接约束。 |
| `FlowNodeDefaults` | 接口 | 新建节点时的默认值。 |
| `FlowNodeInit` | 接口 | 新建节点的参数。 |
| `FlowNodeType` | 接口 | 规范化后的节点类型：端口展开为具名端口列表。 |
| `FlowNodeTypeDefinition` | 接口 | 节点类型定义：同时驱动物料面板、属性面板、连线约束与结构校验。 |
| `FlowNodeTypeRegistry` | 接口 | 节点类型登记表。 |
| `FlowPort` | 接口 | 规范化后的端口。 |
| `FlowPortDefinition` | 接口 | 具名端口定义。 |
| `FlowPortDirection` | 类型 | 端口方向：只入、只出或双向。 |
| `FlowPortPreset` | 类型 | 端口预设：in 为左侧入口 in，out 为右侧出口 out，both 为两者都有，none 为无端口。 |
| `FlowPortSide` | 类型 | 端口所在的节点边。 |
| `FlowPropertyControl` | 类型 | 节点属性的编辑方式：内建的编辑方式之外，扩展可以登记自己的种类（如受理人选择），编辑器由设计器层的扩展提供。 |
| `FlowPropertyDescriptor` | 类型 | 节点属性描述：path 相对节点本身，如 ['data', 'properties', 'Url']、['label']。 |
| `getPortPosition` | 函数 | 计算端口在世界坐标系中的位置。 |
| `portAllows` | 函数 | 判断端口能否作为连线的指定一端：起点需可出，终点需可入。 |

### schema

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createDocument` | 函数 | 创建空文档。 |
| `FLOW_DOCUMENT_VERSION` | 常量 | 当前文档 schema 版本。 |
| `FlowDocument` | 接口 | 流程图文档；数组顺序即绘制层级，靠后的在上层。 |
| `FlowEdge` | 接口 | 连线：起止端点、标签、外观、业务数据与可选折点。 |
| `FlowEdgeStyle` | 接口 | 连线外观。 |
| `FlowEndpoint` | 接口 | 连线端点：节点与可选端口。 |
| `FlowNode` | 接口 | 节点：左上角坐标、尺寸、可选标签与业务数据。 |
| `FlowPoint` | 接口 | 世界坐标系中的点。 |
| `FlowRect` | 接口 | 轴对齐矩形。 |
| `FlowSize` | 接口 | 尺寸。 |

### validate

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `checkConnection` | 函数 | 检查在 source 与 target 之间新增一条连线是否违反端口与连接约束，返回全部问题；空数组表示允许连接。 |
| `DEFAULT_ISSUE_SEVERITY` | 常量 | 各问题码的缺省严重程度。 |
| `FlowConnectionCheckOptions` | 接口 | 连接检查选项。 |
| `FlowConnectionIssueCode` | 类型 | 连接检查可能给出的问题码。 |
| `FlowConnectionProblem` | 接口 | 一条连接问题；end 指出问题出在哪一端，自环问题不带 end。 |
| `FlowValidateOptions` | 接口 | 校验选项。 |
| `resolveEndpointPort` | 函数 | 解析端点实际连接的端口：指定了端口时按 id 查找，否则取第一个允许该端的端口。 |
| `validateDocument` | 函数 | 按扩展合出的流程模型校验文档结构，返回全部问题，每条都带上严重程度。 |
