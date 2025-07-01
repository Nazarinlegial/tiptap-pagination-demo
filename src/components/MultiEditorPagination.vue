<template>
  <div class="multi-editor-wrapper">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-content">
        <!-- 文本格式化 -->
        <div class="toolbar-group">
          <button
            @click="executeCommand('toggleBold')"
            :class="['toolbar-btn', isActive('bold') ? 'active' : '']"
            type="button"
            title="Bold"
          >
            <span class="font-bold">B</span>
          </button>
          
          <button
            @click="executeCommand('toggleItalic')"
            :class="['toolbar-btn', isActive('italic') ? 'active' : '']"
            type="button"
            title="Italic"
          >
            <span class="italic font-medium">I</span>
          </button>
        </div>

        <!-- 分隔符 -->
        <div class="toolbar-separator"></div>

        <!-- 页面控制 -->
        <div class="toolbar-group">
          <button
            @click="addNewPage"
            class="toolbar-btn"
            type="button"
            title="Add New Page"
          >
            📄+
          </button>
          
          <button
            @click="deletePage"
            class="toolbar-btn"
            type="button"
            title="Delete Current Page"
            :disabled="visiblePageCount <= 1"
          >
            🗑️
          </button>
        </div>

        <!-- 分隔符 -->
        <div class="toolbar-separator"></div>

        <!-- 页面信息 -->
        <div class="page-info">
          页面 {{ currentPageIndex + 1 }} / {{ visiblePageCount }}
          <span 
            v-if="currentPage && currentPage.paginationCount && currentPage.paginationCount > 0" 
            class="pagination-count"
          >
            (分页: {{ currentPage.paginationCount }}/3)
          </span>
          <span class="preloaded-info">
            (预创建: {{ preloadedPagePool.length }})
          </span>
        </div>

        <!-- 分隔符 -->
        <div v-if="currentPage && currentPage.paginationCount && currentPage.paginationCount > 0" class="toolbar-separator"></div>

        <!-- 重置分页计数 -->
        <div v-if="currentPage && currentPage.paginationCount && currentPage.paginationCount > 0" class="toolbar-group">
          <button
            @click="resetPaginationCount(currentPageIndex)"
            class="toolbar-btn reset-btn"
            type="button"
            title="重置分页计数"
          >
            🔄
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑器页面列表 -->
    <div class="editor-container">
      <div
        v-for="(page, index) in visiblePages"
        :key="page.id"
        class="page-wrapper"
        :class="{ 'active-page': index === currentPageIndex }"
        @click="setCurrentPage(index)"
      >
        <!-- A4页面容器 -->
        <div class="a4-page" :id="`page-${page.id}`">
          <!-- 页面内容 -->
          <div class="page-content" :ref="el => setPageContentRef(el, index)">
            <editor-content 
              :editor="(page.editor as any)" 
              class="tiptap-content"
              @focus="setCurrentPage(index)"
            />
          </div>
          
          <!-- 页码 -->
          <div class="page-number">
            第 {{ index + 1 }} 页
          </div>
          
          <!-- 自动分页提示 -->
          <div 
            v-if="page.isAutoPaginating"
            class="auto-pagination-indicator"
          >
            正在自动分页...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { useMultiEditorPagination } from '../composables/useMultiEditorPagination'

// 使用 composable
const {
  // 响应式数据
  preloadedPagePool,
  visiblePageCount,
  currentPageIndex,
  
  // 计算属性
  visiblePages,
  currentPage,
  
  // 方法
  addNewPage,
  deletePage,
  setCurrentPage,
  executeCommand,
  isActive,
  resetPaginationCount,
  setPageContentRef,
  initialize,
  cleanup
} = useMultiEditorPagination()

// 生命周期
onMounted(() => {
  initialize()
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<style scoped>
.multi-editor-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 1rem;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* 工具栏样式 */
.toolbar {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 8px 12px;
  position: sticky;
  top: 1rem;
  z-index: 10;
  width: 794px;
  max-width: calc(100vw - 2rem);
  margin: 0 auto 20px auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.toolbar-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.2s ease;
  color: #64748b;
  border: none;
  background: transparent;
  cursor: pointer;
}

.toolbar-btn:hover {
  background: #e2e8f0;
  color: #334155;
}

.toolbar-btn.active {
  background: #3b82f6;
  color: white;
}

.toolbar-btn:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.toolbar-separator {
  height: 20px;
  width: 1px;
  background: #e1e5e9;
  margin: 0 4px;
}

.page-info {
  font-size: 12px;
  color: #6b7280;
  padding: 4px 8px;
  background: #f3f4f6;
  border-radius: 4px;
}

.pagination-count {
  color: #ef4444;
  font-weight: 600;
  margin-left: 4px;
}

.reset-btn {
  background-color: #f59e0b !important;
  color: white !important;
}

.reset-btn:hover {
  background-color: #d97706 !important;
}

.preloaded-info {
  color: #6b7280;
  font-size: 10px;
  margin-left: 4px;
}

/* 编辑器容器 */
.editor-container {
  width: 794px;
  max-width: calc(100vw - 2rem);
  margin: 0 auto;
}

.page-wrapper {
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.page-wrapper:hover {
  transform: translateY(-2px);
}

.page-wrapper.active-page {
  transform: translateY(-4px);
}

/* A4页面样式 */
.a4-page {
  width: 794px;
  min-height: 1123px;
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.1),
    0 4px 20px rgba(0, 0, 0, 0.15),
    0 8px 40px rgba(0, 0, 0, 0.1);
  position: relative;
  box-sizing: border-box;
}

.page-content {
  padding: 60px;
  min-height: 943px; /* A4内容区域高度 */
  max-height: 943px;
  overflow: hidden;
}

.page-number {
  position: absolute;
  bottom: 20px;
  right: 30px;
  font-size: 12px;
  color: #666;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e1e5e9;
}

.auto-pagination-indicator {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: #3b82f6;
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 11px;
  animation: fadeInOut 1s infinite;
  z-index: 5;
  pointer-events: none;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* 编辑器内容样式 */
.tiptap-content :deep(.ProseMirror) {
  outline: none;
  line-height: 1.6;
  font-size: 16px;
  color: #1f2937;
  min-height: 100%; /* 确保编辑器填充整个内容区域 */
  padding: 0;
  margin: 0;
}

.tiptap-content :deep(h1) {
  font-size: 2rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem 0;
  color: #111827;
}

.tiptap-content :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem 0;
  color: #1f2937;
}

.tiptap-content :deep(p) {
  margin: 0.75rem 0;
  line-height: 1.6;
}

.tiptap-content :deep(ul), 
.tiptap-content :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.tiptap-content :deep(li) {
  margin: 0.25rem 0;
}

.tiptap-content :deep(strong) {
  font-weight: 600;
}

.tiptap-content :deep(em) {
  font-style: italic;
}
</style> 