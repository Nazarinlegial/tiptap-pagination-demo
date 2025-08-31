import React, { useEffect, useRef } from 'react'
import { EditorContent } from '@tiptap/react'
import { useMultiEditorPagination } from '../hooks/useMultiEditorPagination'

const MultiEditorPagination: React.FC = () => {
  const {
    // State
    preloadedPagePool,
    visiblePageCount,
    currentPageIndex,
    
    // Computed
    visiblePages,
    currentPage,
    
    // Methods
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

  // Initialize on mount
  useEffect(() => {
    initialize()
    return () => cleanup()
  }, [])

  return (
    <div className="multi-editor-wrapper">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-content">
          {/* Text formatting */}
          <div className="toolbar-group">
            <button
              onClick={() => executeCommand('toggleBold')}
              className={`toolbar-btn ${isActive('bold') ? 'active' : ''}`}
              type="button"
              title="Bold"
            >
              <span className="font-bold">B</span>
            </button>
            
            <button
              onClick={() => executeCommand('toggleItalic')}
              className={`toolbar-btn ${isActive('italic') ? 'active' : ''}`}
              type="button"
              title="Italic"
            >
              <span className="italic font-medium">I</span>
            </button>
          </div>

          {/* Separator */}
          <div className="toolbar-separator"></div>

          {/* Page controls */}
          <div className="toolbar-group">
            <button
              onClick={addNewPage}
              className="toolbar-btn"
              type="button"
              title="Add New Page"
            >
              📄+
            </button>
            
            <button
              onClick={deletePage}
              className="toolbar-btn"
              type="button"
              title="Delete Current Page"
              disabled={visiblePageCount <= 1}
            >
              🗑️
            </button>
          </div>

          {/* Separator */}
          <div className="toolbar-separator"></div>

          {/* Page info */}
          <div className="page-info">
            页面 {currentPageIndex + 1} / {visiblePageCount}
            {currentPage && currentPage.paginationCount && currentPage.paginationCount > 0 && (
              <span className="pagination-count">
                (分页: {currentPage.paginationCount}/3)
              </span>
            )}
            <span className="preloaded-info">
              (预创建: {preloadedPagePool.length})
            </span>
          </div>

          {/* Reset pagination count */}
          {currentPage && currentPage.paginationCount && currentPage.paginationCount > 0 && (
            <>
              <div className="toolbar-separator"></div>
              <div className="toolbar-group">
                <button
                  onClick={() => resetPaginationCount(currentPageIndex)}
                  className="toolbar-btn reset-btn"
                  type="button"
                  title="重置分页计数"
                >
                  🔄
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor pages */}
      <div className="editor-container">
        {visiblePages.map((page, index) => (
          <div
            key={page.id}
            className={`page-wrapper ${index === currentPageIndex ? 'active-page' : ''}`}
            onClick={() => setCurrentPage(index)}
          >
            {/* A4 page container */}
            <div className="a4-page" id={`page-${page.id}`}>
              {/* Page content */}
              <div 
                className="page-content" 
                ref={(el) => setPageContentRef(el, index)}
              >
                <EditorContent 
                  editor={page.editor} 
                  className="tiptap-content"
                  onFocus={() => setCurrentPage(index)}
                />
              </div>
              
              {/* Page number */}
              <div className="page-number">
                第 {index + 1} 页
              </div>
              
              {/* Auto pagination indicator */}
              {page.isAutoPaginating && (
                <div className="auto-pagination-indicator">
                  正在自动分页...
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MultiEditorPagination

/* Styles */
.multi-editor-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 1rem;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Toolbar styles */
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

/* Editor container */
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

/* A4 page styles */
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
  /* Adjust height calculation: A4 total height(1123px) - top/bottom padding(120px) - page number area reserved(60px) = 943px */
  min-height: calc(1123px - 120px - 60px); /* 943px */
  max-height: calc(1123px - 120px - 60px); /* 943px */
  overflow: hidden;
  box-sizing: border-box;
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

/* Editor content styles */
.tiptap-content :deep(.ProseMirror) {
  outline: none;
  line-height: 1.6;
  font-size: 16px;
  color: #1f2937;
  min-height: 100%; /* Ensure editor fills entire content area */
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