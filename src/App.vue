<script setup lang="ts">
import { ref } from 'vue'
import { Document, Message } from '@element-plus/icons-vue'
import MultiEditorPagination from './components/MultiEditorPagination.vue'

// 处理函数
const openGitHub = () => {
  window.open('https://github.com/Cassielxd/tiptap-pagination-demo', '_blank')
}

const openEmail = () => {
  window.location.href = 'mailto:348040933@qq.com'
}
</script>

<template>
  <el-container class="app-container">
    <!-- 头部 -->
    <el-header class="app-header">
      <div class="header-content">
        <div class="title-section">
          <el-space direction="vertical" :size="4">
            <h1 class="app-title">
              <el-icon class="title-icon"><Document /></el-icon>
              tiptap分页编辑器
            </h1>
            <p class="app-subtitle">模块化架构的智能分页富文本编辑器</p>
          </el-space>
        </div>
        
        <div class="action-section">
          <el-space :size="16">
            <el-button 
              type="info" 
              :icon="Document" 
              link
              @click="openGitHub"
            >
              GitHub
            </el-button>
            
            <el-button 
              type="info" 
              :icon="Message" 
              link
              @click="openEmail"
            >
              联系我们
            </el-button>
          </el-space>
        </div>
      </div>
    </el-header>

    <!-- 主要内容区域 -->
    <el-main class="app-main">
      <div class="editor-container">
        <MultiEditorPagination />
      </div>
    </el-main>
    
    <!-- 页脚 -->
    <el-footer class="app-footer">
      <div class="footer-content">
        <el-space direction="vertical" alignment="center" :size="8">
          <el-text type="info" size="small">
            Built with ❤️ using Vue 3, TypeScript, Tiptap & Element Plus
          </el-text>
          
          <el-text type="placeholder" size="small">
            © 2025 Editor Plus
          </el-text>
        </el-space>
      </div>
    </el-footer>
  </el-container>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.app-header {
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: var(--el-box-shadow-light);
  padding: 16px 0;
  height: auto !important;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: var(--el-color-primary);
}

.app-subtitle {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0;
}

.app-main {
  padding: 32px 24px;
  background: var(--el-bg-color-page);
}

.editor-container {
  max-width: 1200px;
  margin: 0 auto;
}

.app-footer {
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  padding: 24px 0;
  height: auto !important;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .app-title {
    font-size: 20px;
  }
  
  .app-main {
    padding: 16px 12px;
  }
  
  .header-content,
  .footer-content {
    padding: 0 16px;
  }
}

/* Element Plus 组件样式调整 */
.el-button.is-link {
  font-size: 13px;
  font-weight: 500;
}

.el-button.is-link:hover {
  color: var(--el-color-primary);
}
</style>
