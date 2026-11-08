# 更新日志

本页记录曦寒流程设计器各版本的变更，只收使用者能感知的改动。`@xihan-flow/core`、`@xihan-flow/runtime`、`@xihan-flow/designer` 三个包总是同一个版本号一起发布。

## v1.0.0（2026-11-08）

首个正式版，以原生 Web Components 交付，不绑定前端框架。流程定义是纯 JSON，查看器展示运行状态，设计器可视化编辑，自带 XiHan 工作流引擎的节点预设。需要 XiHan.UI 5.4.0 及以上。

- **新增** `@xihan-flow/core`：流程定义的结构、校验与问题码、可撤销的编辑操作与连线几何；`@xihan-flow/core/presets/xihan-workflow` 是 XiHan 工作流引擎的节点预设，流程定义与引擎定义能互相转换。纯 TypeScript，不依赖 DOM。
- **新增** `@xihan-flow/runtime`：`<xh-flow-viewer>` 查看器：按节点类型画出流程，标出运行状态与高亮，缩放、平移与导出图片；界面语言包与 XiHan.UI 内建语言一一对应。
- **新增** `@xihan-flow/designer`：`<xh-flow-designer>` 可视化设计器：物料拖放、连线与改连、对齐吸附、自动布局、属性面板与问题列表、小地图、撤销重做与本机草稿。节点类型、属性、规则、命令、面板等都能经 `extensions` 扩展。
