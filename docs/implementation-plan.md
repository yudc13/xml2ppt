# Slide XML Editor 实施计划 Task List

## 1. 项目目标
将特定格式的 Slide XML 转换为可编辑 HTML 界面，并支持将编辑结果可靠地持久化回 XML。

## 2. 技术栈
- 解析/序列化：`fast-xml-parser`
- 前端框架：`Next.js`
- 状态管理：`Zustand`
- 样式方案：`Tailwind CSS` + 绝对定位布局

## 3. 实施任务清单

### Phase 1: 数据转换层（Data Transformation）
- [x] 实现 XML -> JSON Parser
- [x] 将 shape 属性（如 `topLeftX`、`width`）统一转换为 `number`
- [x] 映射 `type="round-rect"` 为 `borderRadius: 8px`
- [x] 解析并规范化 `rgba(r, g, b, a)` 颜色字符串
- [x] 实现 JSON -> XML Serializer
- [x] 逆向还原 XML 节点结构
- [x] 确保 `p`、`span` 嵌套逻辑在序列化后不丢失

### Phase 2: 画布渲染（Canvas Rendering）
- [x] 实现 `960x540` 的 Viewport 等比例缩放容器
- [x] 实现 Shape 组件基础渲染
- [x] 动态绑定样式：`left`、`top`、`width`、`height`、`background`
- [x] 渲染富文本内容
- [x] 全局加载字体：Montserrat、Open Sans

### Phase 3: 交互增强（Interaction）
- [x] 实现拖拽（Drag）并同步位移到 Store
- [x] 实现缩放（Resize）并同步尺寸到 Store
- [x] 实现文本内联编辑（Inline Editing）
- [x] 点击文本进入 `contenteditable` 模式
- [x] 失焦时同步 HTML 内容到 JSON 状态
- [x] 实现 Z-Index 管理（置顶/置底）

### Phase 4: 同步与导出（Sync & Export）
- [x] 实现 Save 接口：调用 Serializer 并通过 API 提交 XML
- [x] 实现 Preview 模式：切换只读状态并隐藏辅助线

## 4. 关键数据结构（State Schema）
- [ ] 定义 `SlideState`（页面级状态）
- [ ] 定义 `ShapeModel`（位置、尺寸、样式、文本）
- [ ] 定义编辑态（选中、拖拽、缩放、预览）
- [ ] 定义 XML/JSON 双向映射字段表

## 5. 风险与注意事项（Tips）
- [ ] 坐标精度：存储保留 2 位小数，渲染时使用 `Math.round`
- [ ] 层级规则：XML 中后出现的 shape 默认 `z-index` 更高
- [ ] 颜色映射：`rgba(r, g, b, a)` 可直接映射为 CSS 颜色值
