# 富文本编辑器

一个基于 Vue 3 + TypeScript + Vite + Element Plus + Tiptap + Tailwind CSS 构建的现代化富文本编辑器。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速的前端构建工具
- **Element Plus** - Vue 3 的桌面端组件库
- **Tiptap** - 无头富文本编辑器
- **Tailwind CSS** - 实用优先的CSS框架

## 功能特性

### 基础编辑功能
- ✅ **文本格式化**：粗体、斜体、删除线
- ✅ **标题设置**：支持 H1、H2、H3 标题
- ✅ **文本对齐**：左对齐、居中对齐、右对齐
- ✅ **列表支持**：无序列表、有序列表
- ✅ **引用块**：支持引用文本格式
- ✅ **分割线**：插入水平分割线

### 高级功能
- ✅ **表格编辑**：插入和编辑表格
- ✅ **颜色设置**：文本颜色自定义
- ✅ **撤销重做**：支持操作历史管理
- ✅ **响应式设计**：适配移动端和桌面端

### 界面特性
- 🎨 美观的工具栏设计
- 📱 响应式布局
- 🔧 丰富的工具按钮
- 🎯 直观的用户体验
- 🌈 Tailwind CSS驱动的现代化样式
- ⚡ 高性能的CSS优化

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发环境运行

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
rich-text-editor/
├── src/
│   ├── assets/
│   │   └── main.css            # 主样式文件（集成Tailwind CSS）
│   ├── components/
│   │   └── TiptapEditor.vue    # 富文本编辑器组件
│   ├── App.vue                 # 主应用组件
│   └── main.ts                 # 应用入口文件
├── tailwind.config.js          # Tailwind CSS配置
├── postcss.config.js           # PostCSS配置
├── package.json
└── README.md
```

## 使用说明

### 编辑器工具栏功能

| 工具 | 功能 | 快捷键 |
|------|------|--------|
| **B** | 粗体 | Ctrl/Cmd + B |
| ***I*** | 斜体 | Ctrl/Cmd + I |
| ~~S~~ | 删除线 | Ctrl/Cmd + Shift + X |
| H1/H2/H3 | 标题 | Ctrl/Cmd + Alt + 1/2/3 |
| 对齐按钮 | 文本对齐 | - |
| 列表按钮 | 无序/有序列表 | Ctrl/Cmd + Shift + 8/9 |
| 引用 | 引用块 | Ctrl/Cmd + Shift + B |
| 表格 | 插入表格 | - |
| 颜色 | 文本颜色 | - |
| 撤销/重做 | 操作历史 | Ctrl/Cmd + Z/Y |

### 组件使用

在其他项目中使用此编辑器组件：

```vue
<template>
  <TiptapEditor />
</template>

<script setup>
import TiptapEditor from './components/TiptapEditor.vue'
</script>
```

## 自定义扩展

编辑器支持 Tiptap 的所有扩展插件，可以根据需要添加更多功能：

```typescript
// 在 TiptapEditor.vue 中添加更多扩展
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
// 添加其他扩展...

const editor = new Editor({
  extensions: [
    StarterKit,
    // 在这里添加更多扩展
  ],
})
```

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

MIT License
