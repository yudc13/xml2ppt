# 历史版本 Diff 实现方案

## 目标

在现有历史版本能力（列表、预览、回滚）上补充“版本差异对比”，帮助用户快速回答：

- 这次版本相比当前版本改了什么？
- 改动属于新增、删除，还是位置/尺寸/文本变化？

本方案优先落地单页（slide）级别 diff，不做 deck 全量聚合。

## 设计原则

- 复用现有 `slide_revision.xml_content` 快照，不新增数据表。
- 不做原始 XML 文本 diff，改为“解析后模型 diff”。
- 先做可解释的结构化差异（MVP），后续再做精细文本标注和画布高亮。

## API 设计

- 路径：`GET /api/slides/[slideId]/diff?from=<version>&to=<version>`
- 鉴权：复用 `getAuthenticatedUser + getSlideAccessRole`，具备 `canView` 即可查询。
- 参数：
- `from`: 正整数，起始版本号（必填）
- `to`: 正整数，目标版本号（必填）

响应示例：

```json
{
  "ok": true,
  "diff": {
    "fromVersion": 12,
    "toVersion": 15,
    "summary": {
      "totalChanges": 4,
      "added": 1,
      "removed": 0,
      "movedResized": 2,
      "textChanged": 1
    },
    "changes": [
      {
        "type": "moved_resized",
        "shapeId": "shape-title",
        "shapeType": "text",
        "summary": "位置/尺寸/旋转发生变化"
      }
    ]
  }
}
```

## Diff 算法（MVP）

输入：`fromXml`、`toXml`  
输出：`SlideDiffResult`

步骤：

1. 使用 `parseSlideXml` 将两份 XML 解析为 `SlideDocumentModel`。
2. 以 `shape.attributes.id` 建立 `fromMap` 与 `toMap`。
3. 计算三类集合：
- `to - from` => `added`
- `from - to` => `removed`
- `from ∩ to` => 进一步比较属性差异
4. 对共同 shape 比较：
- 几何差异：`topLeftX/topLeftY/width/height/rotation`
- 文本差异：提取 `rawNode.content` 下所有 `#text` 拼接比较
5. 生成结构化变更项：
- `added`
- `removed`
- `moved_resized`
- `text_changed`
6. 统计 `summary` 并返回。

## 前端交互（历史面板）

- 在每条历史版本卡片新增“对比当前”按钮。
- 点击后请求 diff API（`from=revision.version`，`to=activeVersion`）。
- 在该版本卡片下展示：
- 统计摘要（新增/删除/布局变化/文本变化）
- 变更清单（按类型+shapeId+简要说明）

说明：

- 当版本就是当前版本时，不展示对比按钮。
- 对比失败显示对应错误信息，不影响现有预览/回滚功能。

## 已知边界

- 依赖 `shapeId` 稳定性；若历史数据存在缺失或重建 id，可能出现“删除+新增”而非“修改”。
- 当前不做字符级文本 diff，仅做文本整体变化检测。
- 当前不做样式字段（颜色、边框、字体）粒度 diff。

## 后续增强建议

1. 形状样式 diff（填充、边框、字号、字体）。
2. 文本字符级 diff（插入/删除高亮）。
3. 画布高亮联动（点击 diff 项定位 shape）。
4. deck 级 diff 汇总（按 slide 聚合）。
