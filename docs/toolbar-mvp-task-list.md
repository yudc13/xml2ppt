# Toolbar 功能完善（MVP）Task List

## 1. 目标与范围
面向编辑器 Toolbar 完成一期功能补齐，支持以下能力：
- 文本新增：`大标题`、`标题`、`副标题`、`正文`、`小号正文`
- 图形新增：`矩形`、`圆`、`直线`、`单向箭头`
- 表格新增：`插入表格`、`单元格文本编辑`、`行列增删`

不在本期范围：
- 复杂图形（如多边形、星形）
- 复杂线条（如折线、双向箭头、曲线）
- 表格高级能力（如合并单元格、复杂样式面板）

## 2. 统一交互约定（一期）
- 点击 Toolbar 项后，在画布中心插入默认元素
- 新增元素插入后自动选中
- 文本与表格支持双击进入编辑态
- 新增元素复用现有通用能力：移动、缩放、删除、复制粘贴、层级前后置（以当前系统能力为准）

## 3. 实施任务清单

### Phase 0: 现状梳理与接口对齐
- [ ] 盘点当前 Toolbar 配置结构与插入动作入口
- [ ] 盘点当前画布元素类型与渲染分发机制
- [ ] 确认复用能力：选中、移动、缩放、复制删除、层级管理

### Phase 1: 数据模型扩展
- [x] 新增文本 5 级类型定义与默认样式 payload
- [x] 新增图形类型定义（矩形、圆、直线、单向箭头）
- [x] 新增表格类型定义（默认行列、单元格结构）
- [ ] 补齐序列化/反序列化字段，确保保存与加载兼容

### Phase 2: Toolbar 接入
- [x] 增加 Toolbar 分组：文本 / 图形 / 表格
- [x] 接入 `onInsert` 动作，支持按类型创建默认元素
- [x] 统一新增元素的默认插入位置与默认尺寸

### Phase 3: 画布渲染
- [x] 实现文本 5 级渲染（样式区分）
- [x] 实现矩形、圆渲染
- [x] 实现直线、单向箭头渲染
- [x] 实现表格渲染（默认 3x3）

### Phase 4: 编辑能力
- [x] 文本双击编辑与提交更新
- [x] 表格单元格文本编辑
- [x] 表格行列增删（最小可用交互）
- [x] 编辑态与画布操作态切换（避免焦点冲突）

### Phase 5: 稳定性与回归
- [x] 验证新增元素的复制、删除、层级操作
- [x] 验证保存后重新加载结果一致
- [x] 回归检查既有元素编辑能力不受影响

### Phase 6: 质量检查
- [ ] 运行 `bun run lint`（或 `npm run lint`）并通过
- [ ] 关键路径手测：插入 -> 编辑 -> 保存 -> 重载

## 4. 验收标准（Definition of Done）
- [ ] Toolbar 可插入 5 种文本且样式区分正确
- [ ] Toolbar 可插入矩形、圆、直线、单向箭头
- [ ] Toolbar 可插入表格，支持单元格文本编辑与行列增删
- [ ] 新增元素可正常保存并重新加载
- [ ] 既有功能无明显回归，Lint 通过

## 5. 二期预留（Backlog）
- [ ] 更多基础图形类型
- [ ] 折线/曲线/双向箭头与端点样式
- [ ] 表格合并单元格与复杂样式能力
- [ ] 更完整的对齐吸附与分布能力

## 6. 按模块映射到具体文件路径（执行清单）

### app/
- [x] [`app/page.tsx`](/Users/yudachao/Projects/ydc/ppt/app/page.tsx)：将内联 `Toolbar` 升级为可触发插入动作（文本/图形/表格）
- [x] [`app/page.tsx`](/Users/yudachao/Projects/ydc/ppt/app/page.tsx)：接入新增 store action（插入元素、表格增删行列入口）
- [ ] [`app/api/slides/save/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/slides/save/route.ts)：确认保存接口无需额外字段变更（保持 `{ slideIndex, xml }`）

### components/
- [ ] [`components/editor/slide-viewport.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-viewport.tsx)：保持渲染入口按 `shapes` 统一分发，确认新增元素可被遍历渲染
- [x] [`components/editor/slide-shape.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-shape.tsx)：扩展渲染分支，支持 `矩形/圆/直线/单向箭头/表格`
- [x] [`components/editor/slide-shape.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-shape.tsx)：补齐文本 5 级默认样式渲染与编辑态行为
- [x] [`components/editor/slide-shape.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-shape.tsx)：实现表格单元格编辑与基础行列增删交互
- [ ] （建议新增）`components/editor/toolbar.tsx`：从 `app/page.tsx` 抽离 Toolbar 逻辑，降低页面复杂度（可选）

### features/
- [x] [`features/slide-editor/store.ts`](/Users/yudachao/Projects/ydc/ppt/features/slide-editor/store.ts)：新增插入 action（`insertTextPreset`、`insertShape`、`insertTable`）
- [x] [`features/slide-editor/store.ts`](/Users/yudachao/Projects/ydc/ppt/features/slide-editor/store.ts)：新增表格结构更新 action（`add/remove row/column`、`updateTableCell`）
- [ ] [`features/slide-editor/store.ts`](/Users/yudachao/Projects/ydc/ppt/features/slide-editor/store.ts)：补齐新增元素默认尺寸、默认位置、zIndex 策略
- [ ] [`features/slide-editor/store.ts`](/Users/yudachao/Projects/ydc/ppt/features/slide-editor/store.ts)：确保 `buildSlideDocumentModel` 对新增元素可正确导出

### types/（当前仓库暂无该目录）
- [x] 方案 A（最小改动）：继续复用 [`lib/slide-xml/types.ts`](/Users/yudachao/Projects/ydc/ppt/lib/slide-xml/types.ts) 扩展类型
- [ ] 方案 B（结构优化，可选）：新增 `types/slide-editor.ts` 承载编辑器内部类型，再由 `store` 和 `components` 复用
- [ ] 无论采用 A/B，需补齐：文本预设类型、图形类型、线/箭头类型、表格数据结构类型

### lib/
- [x] [`lib/slide-xml/types.ts`](/Users/yudachao/Projects/ydc/ppt/lib/slide-xml/types.ts)：扩展 `ShapeType` 与新增元素属性定义
- [ ] [`lib/slide-xml/parser.ts`](/Users/yudachao/Projects/ydc/ppt/lib/slide-xml/parser.ts)：兼容解析新增类型（线/箭头/表格）并保留数值字段规范化
- [ ] [`lib/slide-xml/serializer.ts`](/Users/yudachao/Projects/ydc/ppt/lib/slide-xml/serializer.ts)：保证新增类型可稳定回写 XML
- [ ] [`lib/slide-xml/rich-text.ts`](/Users/yudachao/Projects/ydc/ppt/lib/slide-xml/rich-text.ts)：复用或扩展文本内容构建逻辑，覆盖文本 5 级默认内容

### tests/
- [x] [`lib/slide-xml/slide-xml.test.ts`](/Users/yudachao/Projects/ydc/ppt/lib/slide-xml/slide-xml.test.ts)：新增用例覆盖新增元素 parse/serialize 往返一致性
- [ ] （建议新增）`features/slide-editor/store.test.ts`：覆盖插入、表格行列增删、单元格编辑 action
- [ ] （可选）增加最小交互测试：插入 -> 编辑 -> 保存 -> 重载
