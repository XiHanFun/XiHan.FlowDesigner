# 与宿主集成

查看器与设计器只管显示与编辑，不发网络请求，也不碰存储与权限。把它们嵌进业务系统时，下面这些由宿主来做：

| 事情 | 宿主做什么 | 元素给什么 |
| --- | --- | --- |
| 流程的保存 | 存流程定义，或换成引擎定义交给工作流引擎；管版本与发布 | `schema`、`schema-change`、`save`、`dirty`、`markSaved()`，预设的 `toWorkflowDefinition` |
| 运行状态 | 从后端取实例的执行情况，换成节点的状态 | 查看器的 `statuses`、`setNodeStatuses()`、`highlightNodes()` |
| 权限 | 决定谁能看、谁能改，服务端再复核 | `readonly`、`panels`、`extensions` |
| 校验 | 保存前拦住有错误的定义，服务端复核 | `validate()`、`issues-change`、`validateDocument` |
| 业务数据 | 受理人、表单这类要查宿主数据才能选的属性 | 设计器层扩展的属性编辑器 |

## 打开与保存

流程定义是一份完整的 JSON，原样存、原样取。对接 XiHan 工作流引擎时存的是引擎定义：打开时把取回的定义交给 `fromWorkflowDefinition`，结果赋给 `schema`；保存时把 `schema` 交给 `toWorkflowDefinition`，再交给后端。不用引擎时直接存取流程定义本身。

<<< @/examples/snippets/host.ts#save

- 保存前用 `validate()` 拦住错误级的问题，警告不拦。
- 保存是异步的，用户可能在等待期间接着改。示例在发出请求时记下当时的定义，成功后只有定义没再变才调用 `markSaved()`。

设计器在内存里改流程，页面关掉修改就没了。有未保存的修改时提醒用户：

<<< @/examples/snippets/host.ts#leave

## 显示运行状态

业务页面用查看器显示某个实例走到了哪里：宿主从后端取实例里各节点的执行情况，换成「节点 id → 状态」交给 `statuses`，走过的节点可以再高亮出来。查看器为 `running`、`completed`、`waiting`、`faulted`、`canceled`、`compensated` 各画了一种样子，后端的状态名不同时在宿主这边换好，详见[查看器](./viewer#运行状态)。

<<< @/examples/snippets/host.ts#status

实例还在运行时，宿主按自己的节奏重新取，用 `setNodeStatuses()` 只更新变了的节点。

## 权限

- 只能看的用户：设计器设成 `readonly`，仍可选择、浏览与复制；只需要看的页面直接用查看器，它更轻。
- 只让调整局部的场景，用 `panels` 去掉物料等区，用 `commandLayout` 精简命令，用自定义属性编辑器限定可选的值。
- 这些都只在前端生效。流程的保存、发布与删除要在服务端判断权限，保存时服务端也应复核流程本身。

## 服务端复核

`@xihan-flow/core` 与预设不依赖 DOM，存流程定义的宿主可以在 Node.js 后端直接读入并校验收到的定义，结论与设计器一致：

<<< @/examples/snippets/host.ts#server

存引擎定义、后端是 XiHan.Framework 的，由引擎在发布时按它自己的规则把关，前端在提交前用 `validate()` 先拦一道。

## 在前端框架里使用

查看器与设计器是原生 Web Components，任何框架都能用：在应用启动时调用一次 `defineFlowViewer()` 或 `defineFlowDesigner()`，之后像普通元素一样放进模板。流程定义、扩展这类对象要交给元素的属性，不要写成 attribute。

在 Vue 里，先告诉编译器 `xh-` 开头的标签是自定义元素，免得被当成组件去解析：

```ts
// vite.config.ts 里 @vitejs/plugin-vue 的选项
vue({
  template: {
    compilerOptions: {
      isCustomElement: tag => tag.startsWith('xh-'),
    },
  },
})
```

对象用 `.prop` 修饰交给属性，事件用 `@` 监听：

<<< @/examples/demos/vue-viewer.vue

<FlowDemo name="vue-viewer" />

React 19 起会把对象直接赋给自定义元素的同名属性；事件可以用 `ref` 拿到元素后 `addEventListener` 监听。

## 文案与样式

- 内建文案缺省是英文。全站用中文时把 `flowZhCN` 与 XiHan.UI 的语言包合并后交给 `setXhConfig`，写法见[快速开始](../quickstart#中文界面)；单个实例的文案用它的 `translations` 覆写。预设的节点类型与属性另有文案，见 [XiHan 工作流引擎预设](./xihan-workflow#装上预设)。
- 样式只用 XiHan.UI 的设计令牌，元素跟着宿主的 UI 主题变化，宿主不用另写颜色。设计器与查看器铺满自身，宿主给元素定宽高。

## 一个页面里放多个实例

元素不往 `window` 上挂对象，也不读写固定键名的本地存储，同一页面里的多个查看器、多个设计器互不影响，各自的扩展也只对自己生效。只有语言包是全局的：`setXhConfig` 对页面上所有元素生效。
