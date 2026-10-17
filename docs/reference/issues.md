# 问题码

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`readDocument` 读入与 `validateDocument` 校验给出的问题都带问题码、从文档根算起的路径、所在对象与严重程度，不带文案；设计器的问题列表与属性面板按语言包把问题码换成说明。说明里花括号括起的是问题参数。

## 校验

`validateDocument` 按节点类型、属性描述与扩展的规则检查流程定义。下表列出内置的问题码、缺省严重程度与中文语言包的说明；严重程度可以经 `FlowValidateOptions.severity` 按问题码改写，写 `off` 即不报告。不带点号的问题码（`required`、`invalid-type`、`out-of-range`、`not-integer`、`invalid-option`、`invalid-color`、`invalid-value`、`unknown-key`、`unknown-control`）来自属性的检查，路径落在那个属性上。

| 问题码 | 缺省严重程度 | 说明 |
| --- | --- | --- |
| `node.duplicate-id` | 错误 | 节点 id「{id}」重复 |
| `node.unknown-type` | 错误 | 节点类型「{type}」没有登记 |
| `edge.duplicate-id` | 错误 | 连线 id「{id}」重复 |
| `edge.dangling` | 错误 | 连线指向不存在的节点「{node}」 |
| `edge.unknown-port` | 错误 | 端口「{port}」不存在 |
| `edge.invalid-direction` | 错误 | 端口方向不允许这样连接 |
| `edge.self-loop` | 错误 | 节点不能连向自己 |
| `edge.target-not-allowed` | 错误 | 「{sourceType}」不能连向「{targetType}」 |
| `edge.source-not-allowed` | 错误 | 「{targetType}」不接受来自「{sourceType}」的连线 |
| `node.max-incoming` | 错误 | 入线最多 {max} 条，现有 {count} 条 |
| `node.max-outgoing` | 错误 | 出线最多 {max} 条，现有 {count} 条 |
| `port.max-connections` | 错误 | 端口「{port}」最多连 {max} 条，现有 {count} 条 |
| `type.min-count` | 错误 | 至少需要 {min} 个「{type}」，现有 {count} 个 |
| `type.max-count` | 错误 | 「{type}」最多 {max} 个，现有 {count} 个 |
| `node.isolated` | 警告 | 没有任何连线 |
| `node.missing-incoming` | 警告 | 缺少入线 |
| `node.missing-outgoing` | 警告 | 缺少出线 |
| `node.unreachable` | 警告 | 从开始节点走不到这里 |
| `required` | 错误 | 必填 |
| `invalid-type` | 错误 | 取值类型不对 |
| `out-of-range` | 错误 | 超出允许的范围 |
| `not-integer` | 错误 | 必须是整数 |
| `invalid-option` | 错误 | 不在可选项里 |
| `invalid-color` | 错误 | 不是有效的颜色 |
| `invalid-value` | 错误 | 取值不合法 |
| `unknown-key` | 错误 | 含有不认识的字段 |
| `unknown-control` | 错误 | 没有这种编辑方式 |

扩展登记的规则自带问题码（如预设的 `xihan-workflow.*`），说明由扩展的 `issueText` 给出。

## 读入

`readDocument` 把未知输入读成流程定义：结构问题用 XiHan.UI `@xihan-ui/designer-kit` 的通用问题码（取值类型不对、缺少必填字段、多出不认识的字段等），见 [designer-kit 的问题形状](https://ui.docs.xihanfun.com/runtime/designer-kit)。流程自己的读入问题码只有一个：

| 问题码 | 说明 |
| --- | --- |
| `document.unsupported-version` | `version` 不是当前支持的版本；参数 `version` 是读到的版本，`supported` 是支持的版本 |
