---
'@xihan-flow/core': major
'@xihan-flow/runtime': major
'@xihan-flow/designer': major
---

**新增** 首次发布，以原生 Web Components 交付，不绑定前端框架。

- `@xihan-flow/core`：流程定义的结构（节点、连线、业务数据与扩展数据）、读入检查、校验与问题码、编辑操作（每一步都能求出逆操作）、连线几何、节点类型登记与扩展合并。纯 TypeScript，不依赖 DOM。`@xihan-flow/core/presets/xihan-workflow` 是 XiHan 工作流引擎的节点预设，节点与引擎的活动类型一一对应，流程定义与引擎定义能互相转换。
- `@xihan-flow/runtime`：`<xh-flow-viewer>` 按节点类型画出流程，标出运行状态与高亮，缩放、平移、定位节点，导出图片；直角连线路由；与 XiHan.UI 内建语言一一对应的界面语言包（`@xihan-flow/runtime/locale`），查看器与设计器共用。
- `@xihan-flow/designer`：`<xh-flow-designer>` 可视化设计器，包括物料拖放、连线与改连、对齐吸附、自动布局、属性面板、问题列表、小地图、撤销重做（每一步带说明，另有历史记录面板）与剪贴板，以及设置对话框（含工具栏按钮的定制与帮助、快捷键、关于三页）、新手引导与整份定义的 JSON 编辑；面板能换栏、收成标题条与浮出，布局随设置保存。节点类型、属性、编辑方式、校验规则、节点渲染、属性编辑器、命令、面板、设置分区、引导步骤与导入导出都能经 `extensions` 登记。
