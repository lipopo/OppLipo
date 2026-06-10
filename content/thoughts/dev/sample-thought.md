---
title: 示例：Markdown 渲染管线
date: 2026-06-10
excerpt: 如何零依赖地实现一个 markdown 渲染器
appSlugs: []
---

## 背景

做这个站点的过程中，我需要一个 markdown 渲染器，但又不想引入 npm 依赖。

## 实现思路

> 关键在于：先做提取，再做转义，最后做替换。

具体步骤：

1. 先把代码块提取出来（用占位符）
2. 再对剩余内容做 HTML 转义
3. 然后按行处理：标题、列表、段落、引用
4. 最后做行内替换：链接、粗体、斜体
5. 把占位符还原

## 代码示例

内联代码像 `npm install` 这样。代码块：

```js
function slugify(path) {
  return path.replace(/^content\/thoughts\//, '').replace(/\.md$/, '').replace(/\//g, '--');
}
```

## 一些想法

- 零依赖的代码量其实不大
- 但**测试覆盖**必须够，否则边界条件很难调
- *不要*自己实现完整的 CommonMark，规范太复杂
