// 页面池管理相关的工具函数

import { Editor } from '@tiptap/vue-3'
import { PAGE_CONFIG } from './pageCalculations'
import { createEditorInstance, deactivateEditor, clearEditorContent } from './editorFactory'

// 页面数据结构
export interface PageData {
  id: string
  editor: any // 使用 any 来兼容复杂的 Editor 类型
  hasOverflow: boolean
  contentHeight: number
  isAutoPaginating?: boolean
  paginationCount?: number
  isVisible: boolean
  isPreloaded: boolean
  editorId: string
}

// 创建页面数据
export const createPageData = (
  editor: any, 
  isVisible: boolean = false, 
  isPreloaded: boolean = true
): PageData => {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    editor,
    hasOverflow: false,
    contentHeight: 0,
    isAutoPaginating: false,
    paginationCount: 0,
    isVisible,
    isPreloaded,
    editorId: (editor as any).editorId
  }
}

// 预创建页面池
export const createPagePool = (
  count: number, 
  onUpdate: (editor: any) => void,
  onSelectionUpdate: (editor: any) => void
): PageData[] => {
  const startTime = performance.now()
  
  const pool: PageData[] = []
  
  for (let i = 0; i < count; i++) {
    const editor = createEditorInstance({
      content: '<p></p>',
      isPreloaded: true,
      onUpdate,
      onSelectionUpdate,
      onCreate: () => {
        // 初始化时的处理
      }
    })
    
    if (i > 0) {
      deactivateEditor(editor)
    }
    
    const page = createPageData(editor, i === 0, true)
    pool.push(page)
  }
  
  const endTime = performance.now()
  
  return pool
}

// 扩容页面池
export const expandPagePool = (
  currentPool: PageData[], 
  onUpdate: (editor: any) => void,
  onSelectionUpdate: (editor: any) => void
): PageData[] => {
  
  const newPages = createPagePool(PAGE_CONFIG.EXPAND_COUNT, onUpdate, onSelectionUpdate)
  
  // 新创建的页面都设为不可见且不可编辑
  newPages.forEach(page => {
    page.isVisible = false
    deactivateEditor(page.editor)
  })
  
  return [...currentPool, ...newPages]
}

// 检查是否需要扩容
export const shouldExpandPool = (visibleCount: number, poolSize: number): boolean => {
  return visibleCount >= PAGE_CONFIG.EXPAND_THRESHOLD && 
         visibleCount + PAGE_CONFIG.EXPAND_COUNT > poolSize
}

// 获取可见页面
export const getVisiblePages = (pool: PageData[], maxCount?: number): PageData[] => {
  const visiblePages = pool.filter(page => page.isVisible)
  return maxCount ? visiblePages.slice(0, maxCount) : visiblePages
}

// 获取下一个可用页面
export const getNextAvailablePage = (pool: PageData[]): PageData | null => {
  return pool.find(page => !page.isVisible) || null
}

// 重置页面状态
export const resetPageState = (page: PageData): void => {
  clearEditorContent(page.editor)
  page.isVisible = false
  page.hasOverflow = false
  page.contentHeight = 0
  page.isAutoPaginating = false
  page.paginationCount = 0
}

// 激活页面
export const activatePage = (page: PageData): void => {
  page.isVisible = true
  page.editor.setOptions({ editable: true })
}

// 停用页面
export const deactivatePage = (page: PageData): void => {
  resetPageState(page)
  deactivateEditor(page.editor)
}

// 清理页面池
export const cleanupPagePool = (pool: PageData[]): void => {
  pool.forEach(page => {
    page.editor.destroy()
  })
} 