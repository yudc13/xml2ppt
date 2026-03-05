# Toolbar 功能完善（二期）Task List

## 1. 目标与范围
本期聚焦以下能力，优先级从高到低：
- 表格插入升级：动态选择行列（1x1 到 10x10）
- 表格默认样式：表头背景色 + 文本水平/垂直居中
- 拖拽吸附：吸附到其他元素边缘与中心
- 实时参考线：拖拽时展示，松手后消失

不在本期范围：
- 表格合并/拆分单元格
- 多选框选与分布/对齐批量操作
- 复杂线条与新增图形种类扩展

## 2. 需求约束（已确认）
- 表格动态选择上限：`10 x 10`
- 表头默认背景色：`#f1f5f9`
- 表格文本默认对齐：水平 + 垂直居中
- 吸附对象：其他元素边缘与中心（不含自身）
- 参考线：实时显示，释放拖拽后清除

## 3. 实施任务清单

### Phase 0: 基线梳理
- [ ] 梳理 Toolbar 表格插入入口与事件流
- [ ] 梳理 shape 拖拽逻辑与可插入吸附计算点
- [ ] 梳理 viewport 叠加层渲染参考线的位置

### Phase 1: 表格动态网格插入
- [ ] 将“插入 3x3 表格”改为网格选择面板（1~10 行列）
- [ ] 支持 hover 预览高亮选区
- [ ] 点击后按选区尺寸创建表格并自动选中
- [ ] 超出上限时自动 clamp 到 10x10

### Phase 2: 表格默认样式升级
- [ ] 首行渲染为表头样式（背景 `#f1f5f9`）
- [ ] 单元格文本默认水平居中
- [ ] 单元格文本默认垂直居中
- [ ] 编辑态（textarea）与展示态视觉一致

### Phase 3: 吸附与参考线
- [ ] 拖拽时计算当前元素边缘/中心与其他元素边缘/中心的距离
- [ ] 阈值命中后自动吸附（X/Y 独立）
- [ ] 渲染实时参考线（垂直/水平）
- [ ] 拖拽结束时清空参考线

### Phase 4: 回归验证
- [ ] 核验动态表格插入 + 编辑 + 保存 + 重载
- [ ] 核验不同尺寸元素间吸附表现与参考线稳定性
- [ ] 运行 `bun run lint` 并通过

## 4. 验收标准（Definition of Done）
- [ ] Toolbar 可通过网格选择插入 `1x1 ~ 10x10` 表格
- [ ] 表头默认显示 `#f1f5f9` 背景
- [ ] 表格文本默认水平+垂直居中
- [ ] 拖拽元素时可吸附其他元素边缘/中心
- [ ] 参考线拖拽中出现、松手后消失
- [ ] Lint 通过，无明显回归

## 5. 文件级执行清单
- [ ] [`features/deck-editor/components/deck-editor-client.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/deck-editor-client.tsx)：表格动态网格选择 UI 与插入动作
- [ ] [`features/deck-editor/components/slide-shape.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-shape.tsx)：表格默认样式 + 拖拽吸附计算触发
- [ ] [`features/deck-editor/components/slide-viewport.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-viewport.tsx)：实时参考线渲染
- [ ] [`features/slide-editor/store.ts`](/Users/yudachao/Projects/ydc/ppt/features/slide-editor/store.ts)：参考线状态与吸附辅助状态管理
