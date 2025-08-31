// Page pool management related utility functions

import { Editor } from '@tiptap/react'
import { PAGE_CONFIG } from './pageCalculations'
import { createEditorInstance, deactivateEditor, clearEditorContent } from './editorFactory'

// Page data structure
export interface PageData {
  id: string
  editor: any // Use any to be compatible with complex Editor type
  hasOverflow: boolean
  contentHeight: number
  isAutoPaginating?: boolean
  paginationCount?: number
  isVisible: boolean
  isPreloaded: boolean
  editorId: string
}

// Create page data
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

// Pre-create page pool
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
        // Handle initialization
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

// Expand page pool
export const expandPagePool = (
  currentPool: PageData[], 
  onUpdate: (editor: any) => void,
  onSelectionUpdate: (editor: any) => void
): PageData[] => {
  
  const newPages = createPagePool(PAGE_CONFIG.EXPAND_COUNT, onUpdate, onSelectionUpdate)
  
  // Set newly created pages as invisible and non-editable
  newPages.forEach(page => {
    page.isVisible = false
    deactivateEditor(page.editor)
  })
  
  return [...currentPool, ...newPages]
}

// Check if pool expansion is needed
export const shouldExpandPool = (visibleCount: number, poolSize: number): boolean => {
  return visibleCount >= PAGE_CONFIG.EXPAND_THRESHOLD && 
         visibleCount + PAGE_CONFIG.EXPAND_COUNT > poolSize
}

// Get visible pages
export const getVisiblePages = (pool: PageData[], maxCount?: number): PageData[] => {
  const visiblePages = pool.filter(page => page.isVisible)
  return maxCount ? visiblePages.slice(0, maxCount) : visiblePages
}

// Get next available page
export const getNextAvailablePage = (pool: PageData[]): PageData | null => {
  return pool.find(page => !page.isVisible) || null
}

// Reset page state
export const resetPageState = (page: PageData): void => {
  clearEditorContent(page.editor)
  page.isVisible = false
  page.hasOverflow = false
  page.contentHeight = 0
  page.isAutoPaginating = false
  page.paginationCount = 0
}

// Activate page
export const activatePage = (page: PageData): void => {
  page.isVisible = true
  page.editor.setOptions({ editable: true })
}

// Deactivate page
export const deactivatePage = (page: PageData): void => {
  resetPageState(page)
  deactivateEditor(page.editor)
}

// Cleanup page pool
export const cleanupPagePool = (pool: PageData[]): void => {
  pool.forEach(page => {
    page.editor.destroy()
  })
}