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