import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// Import modules
import { 
  PAGE_CONFIG, 
  isPageReallyEmpty, 
  checkPageOverflowState, 
  canMergeUpward, 
  calculateSplitPoint, 
  isDeletingAtBeginning,
  extractNodeData,
  getPageSizeDebugInfo,
  analyzePageHeightRelation,
  debugOverflowTrigger,
  debugMergeAnalysis,
  trackCursorDuringMerge,
  type NodeData
} from './pageCalculations'

import { 
  splitDocumentContent, 
  splitDocumentContentAsync,
  mergeDocumentContent, 
  mergeDocumentContentAsync,
  documentToNodes, 
  splitNodesByCount, 
  createEmptyDocument,
  analyzeCursorPosition 
} from './contentManagement'

import { useWorkerOptimization } from './useWorkerOptimization'

import { 
  getCursorPosition, 
  moveCursorToStart, 
  moveCursorToEnd, 
  restoreCursorPosition, 
  isCursorAtEndPosition,
  shouldJumpToNextPage 
} from './cursorManager'

import { 
  setEditorContentSafely, 
  clearEditorContent, 
  activateEditor 
} from './editorFactory'

import { 
  type PageData, 
  createPagePool, 
  expandPagePool, 
  shouldExpandPool, 
  getVisiblePages, 
  getNextAvailablePage, 
  resetPageState, 
  activatePage, 
  deactivatePage, 
  cleanupPagePool 
} from './pagePoolManager'

export { PAGE_CONFIG, type PageData }

export function useMultiEditorPagination() {
  // State
  const [preloadedPagePool, setPreloadedPagePool] = useState<PageData[]>([])
  const [visiblePageCount, setVisiblePageCount] = useState(1)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const pageContentRefs = useRef<(HTMLElement | null)[]>([])

  // Worker optimization
  const { 
    isOptimizationEnabled,
    backgroundAnalyzeDocument,
    precalculatePagination,
    batchProcessContent 
  } = useWorkerOptimization()

  // Computed values
  const visiblePages = useMemo(() => {
    return getVisiblePages(preloadedPagePool, visiblePageCount)
  }, [preloadedPagePool, visiblePageCount])

  const currentEditor = useMemo(() => {
    return visiblePages[currentPageIndex]?.editor
  }, [visiblePages, currentPageIndex])

  const currentPage = useMemo(() => {
    return visiblePages[currentPageIndex]
  }, [visiblePages, currentPageIndex])

  // Track content sizes for deletion detection
  const previousContentSizes = useRef(new Map<string, number>())

  // Editor update callback
  const handleEditorUpdate = useCallback((editor: any) => {
    const activePageIndex = currentPageIndex
    if (activePageIndex === -1) return

    setTimeout(() => {
      // Detect deletion and cursor position
      const editorId = (editor as any).editorId
      const currentContentSize = editor.state.doc.content.size
      const previousContentSize = previousContentSizes.current.get(editorId) || 0
      const currentCursor = getCursorPosition(editor)
      const isDeleting = currentContentSize < previousContentSize
      const isAtBeginning = currentCursor.from <= 2
      const isNotFirstPage = activePageIndex > 0
      
      // Update content size record
      previousContentSizes.current.set(editorId, currentContentSize)
      
      // If deleting at beginning and not first page, move to previous page end
      if (isDeleting && isAtBeginning && isNotFirstPage) {
        const currentPageHasContent = editor.getText().trim().length > 0
        
        if (currentPageHasContent) {
          const previousPageIndex = activePageIndex - 1
          const previousPage = visiblePages[previousPageIndex]
          
          if (previousPage) {
            setCurrentPageIndex(previousPageIndex)
            
            setTimeout(() => {
              moveCursorToEnd(previousPage.editor)
            }, 0)
            
            return
          }
        }
      }
      
      // Check empty pages
      const isEmpty = isPageReallyEmpty(editor)
      const isFirstPage = activePageIndex === 0
      const hasMultiplePages = visiblePageCount > 1
      
      if (isEmpty && !isFirstPage && hasMultiplePages) {
        deleteCurrentEmptyPage()
        return
      }
      
      checkPageOverflow(activePageIndex)
    }, 0)
  }, [currentPageIndex, visiblePages, visiblePageCount])

  // Editor selection update callback
  const handleSelectionUpdate = useCallback((editor: any) => {
    const editorElement = editor.view.dom
    const dataEditorId = editorElement.getAttribute('data-editor-id')
    if (dataEditorId) {
      const pageIndex = visiblePages.findIndex(p => p.editorId === dataEditorId)
      if (pageIndex !== -1 && pageIndex !== currentPageIndex) {
        setCurrentPageIndex(pageIndex)
      }
    }
  }, [visiblePages, currentPageIndex])

  // Preload pages
  const preloadPages = useCallback((count: number) => {
    const newPages = createPagePool(count, handleEditorUpdate, handleSelectionUpdate)
    setPreloadedPagePool(prev => [...prev, ...newPages])
  }, [handleEditorUpdate, handleSelectionUpdate])

  // Expand page pool if needed
  const expandPagePoolIfNeeded = useCallback(() => {
    if (shouldExpandPool(visiblePageCount, preloadedPagePool.length)) {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          setPreloadedPagePool(prev => expandPagePool(
            prev, 
            handleEditorUpdate, 
            handleSelectionUpdate
          ))
        })
      } else {
        setTimeout(() => {
          setPreloadedPagePool(prev => expandPagePool(
            prev, 
            handleEditorUpdate, 
            handleSelectionUpdate
          ))
        }, 0)
      }
    }
  }, [visiblePageCount, preloadedPagePool.length, handleEditorUpdate, handleSelectionUpdate])

  // Check page overflow
  const checkPageOverflow = useCallback((pageIndex: number) => {
    // Check if page index is valid
    if (pageIndex < 0 || pageIndex >= visiblePages.length) return
    
    // Get current page data
    const currentPageData = visiblePages[pageIndex]
    if (!currentPageData) return

    // Get page content element
    const contentEl = pageContentRefs.current[pageIndex]
    if (!contentEl) return

    // Check if page content overflows
    const { hasOverflow, actualHeight } = checkPageOverflowState(contentEl)

    // Update page data
    currentPageData.hasOverflow = hasOverflow
    currentPageData.contentHeight = actualHeight

    // If page overflows and is current page, paginate
    if (hasOverflow && pageIndex === currentPageIndex) {
      // Get pagination count
      const paginationCount = currentPageData.paginationCount || 0
      // Stop auto pagination after 3 times
      if (paginationCount >= 3) {
        return
      }

      // If already paginating, skip
      if (currentPageData.isAutoPaginating) {
        return
      }

      currentPageData.isAutoPaginating = true
      
      // Handle overflow content
      setTimeout(async () => {
        await handleOverflow(pageIndex)
      }, 0)
      
    } else if (!hasOverflow) {
      // Stop auto pagination
      if (currentPageData) {
        currentPageData.isAutoPaginating = false
        currentPageData.paginationCount = 0
      }
      
      // Check for upward merge
      checkForUpwardMerge(pageIndex, actualHeight).catch(error => {
        console.warn('向上合并检查失败:', error)
      })
    }
  }, [visiblePages, currentPageIndex])

  // Check for upward merge
  const checkForUpwardMerge = useCallback(async (pageIndex: number, currentHeight: number) => {
    // Get next page index
    const nextPageIndex = pageIndex + 1
    // If next page index exceeds pool, don't merge
    if (nextPageIndex >= visiblePages.length) return
    
    // Get next page data
    const nextPage = visiblePages[nextPageIndex]
    // If next page doesn't exist or not visible, don't merge
    if (!nextPage || !nextPage.isVisible) return
    
    // Get next page DOM element
    const nextPageElement = pageContentRefs.current[nextPageIndex]
    
    // Extract next page node data
    const nextPageNodes = extractNodeData(nextPage.editor)
    
    // Check if can merge upward
    const { canMerge, nodesToMerge } = canMergeUpward(currentHeight, nextPageNodes, nextPageElement || undefined)
    // If can merge, merge next page content to current page
    if (canMerge) {
      await mergeNextPageContent(pageIndex, nextPageIndex, nodesToMerge)
    }
  }, [visiblePages])

  // Merge next page content to current page
  const mergeNextPageContent = useCallback(async (pageIndex: number, nextPageIndex: number, nodesToMerge: number) => {
    // Get current page data
    const currentPageData = visiblePages[pageIndex]
    // Get next page data
    const nextPage = visiblePages[nextPageIndex]
    
    if (!currentPageData || !nextPage) return
    
    // Save cursor position info
    let savedCursorInfo: { position: number, contentSize: number, isActive: boolean } | null = null
    const activePageIndex = currentPageIndex
    const isCurrentlyActiveEditor = pageIndex === activePageIndex
    
    // If current page is active, save detailed cursor info
    if (isCurrentlyActiveEditor) {
      const cursorPos = getCursorPosition(currentPageData.editor)
      const currentContentSize = currentPageData.editor.state.doc.content.size
      
      savedCursorInfo = {
        position: cursorPos.from,
        contentSize: currentContentSize,
        isActive: true
      }
      
      // Debug: record state before merge
      const beforeMerge = trackCursorDuringMerge(currentPageData.editor, '合并前')
      console.log('🔍 合并前光标状态:', beforeMerge)
    }
    
    // Get content nodes
    const currentNodes = documentToNodes(currentPageData.editor.state.doc)
    // Get next page content nodes
    const nextNodes = documentToNodes(nextPage.editor.state.doc)
    // Split next page content
    const { firstPart: nodesToMergeArray, secondPart: remainingNodes } = 
      splitNodesByCount(nextNodes, nodesToMerge)
    
    try {
      // Use Worker for content merging (if available)
      const mergedContent = isOptimizationEnabled
        ? await mergeDocumentContentAsync(currentNodes, nodesToMergeArray)
        : mergeDocumentContent(currentNodes, nodesToMergeArray)
      
      // Update current page content
      currentPageData.editor.commands.setContent(mergedContent)
    } catch (error) {
      console.warn('Worker 内容合并失败，使用同步方法:', error)
      
      // Fallback to sync processing
      const mergedContent = mergeDocumentContent(currentNodes, nodesToMergeArray)
      currentPageData.editor.commands.setContent(mergedContent)
    }
    
    // Debug: record state after content update
    if (savedCursorInfo && savedCursorInfo.isActive) {
      setTimeout(() => {
        const afterContent = trackCursorDuringMerge(currentPageData.editor, '内容更新后')
        console.log('📝 内容更新后光标状态:', afterContent)
      }, 10)
    }
    
    // Smart cursor position restoration
    if (savedCursorInfo && savedCursorInfo.isActive) {
      setTimeout(() => {
        const newContentSize = currentPageData.editor.state.doc.content.size
        
        // Cursor position should stay within original content range
        let targetPosition = savedCursorInfo.position
        
        // Ensure position is within valid range
        const maxValidPosition = Math.min(savedCursorInfo.contentSize - 1, newContentSize - 1)
        targetPosition = Math.min(targetPosition, maxValidPosition)
        targetPosition = Math.max(1, targetPosition) // At least position 1
        
        console.log(`🎯 光标位置计算: 原位置=${savedCursorInfo.position}, 目标位置=${targetPosition}, 新内容大小=${newContentSize}`)
        
        // Focus editor and set cursor position
        currentPageData.editor.commands.focus()
        currentPageData.editor.commands.setTextSelection(targetPosition)
        
        // Debug: record final restored state
        setTimeout(() => {
          const afterRestore = trackCursorDuringMerge(currentPageData.editor, '光标恢复后')
          console.log('✅ 光标恢复后状态:', afterRestore)
        }, 20)
      }, 0)
    }
    
    // Update next page content
    if (remainingNodes.length > 0) {
      try {
        // Use Worker for remaining content merging (if available)
        const remainingContent = isOptimizationEnabled
          ? await mergeDocumentContentAsync([], remainingNodes)
          : mergeDocumentContent([], remainingNodes)
        
        // Update next page content
        nextPage.editor.commands.setContent(remainingContent)
      } catch (error) {
        console.warn('Worker 剩余内容合并失败，使用同步方法:', error)
        
        // Fallback to sync processing
        const remainingContent = mergeDocumentContent([], remainingNodes)
        nextPage.editor.commands.setContent(remainingContent)
      }
      
      // Recursively check next page
      setTimeout(() => {
        setTimeout(() => {
          checkPageOverflow(nextPageIndex)
        }, 100)
      }, 0)
      
    } else {
      // Hide empty page
      nextPage.isVisible = false
      clearEditorContent(nextPage.editor)
      
      const visiblePagesList = getVisiblePages(preloadedPagePool)
      setVisiblePageCount(visiblePagesList.length)
    }
    
    // Recheck current page overflow (delayed to avoid interfering with cursor)
    setTimeout(() => {
      setTimeout(() => {
        // Only check overflow when not active page to avoid interfering with user editing
        if (pageIndex !== currentPageIndex) {
          checkPageOverflow(pageIndex)
        } else {
          // If active page, delay longer for cursor restoration
          setTimeout(() => {
            checkPageOverflow(pageIndex)
          }, 300)
        }
      }, 100)
    }, 0)
  }, [visiblePages, currentPageIndex, isOptimizationEnabled, preloadedPagePool, checkPageOverflow])

  // Handle content overflow
  const handleOverflow = useCallback(async (pageIndex: number) => {
    // Get current page data
    const currentPageData = visiblePages[pageIndex]
    // If current page doesn't exist or doesn't overflow, don't paginate
    if (!currentPageData || !currentPageData.hasOverflow) {
      if (currentPageData) {
        currentPageData.isAutoPaginating = false
      }
      return
    }

    // Update page pagination count
    currentPageData.paginationCount = (currentPageData.paginationCount || 0) + 1

    // Get current page document
    const doc = currentPageData.editor.state.doc
    // Get current page document node count
    const nodeCount = doc.content.childCount

    // Save current cursor position
    const originalCursorPos = currentPageData.editor.state.selection.from

    // Calculate split point (always split by node boundaries)
    const splitPoint = calculateSplitPoint(nodeCount)

    // Analyze cursor position relative to split point
    const cursorAnalysis = analyzeCursorPosition(currentPageData.editor, splitPoint)

    try {
      // Use Worker for document splitting (if available)
      const splitResult = isOptimizationEnabled 
        ? await splitDocumentContentAsync(doc, splitPoint)
        : splitDocumentContent(doc, splitPoint)

      const { firstPageContent, overflowContent } = splitResult

      // Update current page content
      currentPageData.editor.commands.setContent(firstPageContent)
      currentPageData.isAutoPaginating = false

      // Handle cursor position based on analysis result
      if (cursorAnalysis.shouldPreserveCursor && cursorAnalysis.cursorInFirstPart) {
        // Cursor before split point, keep at original position
        setTimeout(() => {
          // Focus current page
          currentPageData.editor.commands.focus()
          // Get current page document node count
          const newDocSize = currentPageData.editor.state.doc.content.size
          // Calculate new cursor position
          const newCursorPos = Math.min(originalCursorPos, newDocSize - 1)
          // Set new cursor position
          currentPageData.editor.commands.setTextSelection(newCursorPos)
        }, 0)
        
        // Don't jump to next page
        await handleOverflowContent(pageIndex, overflowContent, false)
        
      } else {
        // Cursor after split point, or user editing at end
        const shouldMoveCursor = shouldJumpToNextPage(currentPageData.editor)
        
        // Handle overflow content, decide whether to jump based on user editing context
        await handleOverflowContent(pageIndex, overflowContent, shouldMoveCursor)
      }

      // Background document analysis (if optimization enabled)
      if (isOptimizationEnabled && doc.content.childCount > 10) {
        backgroundAnalyzeDocument(doc, (result) => {
          console.log('📊 文档分析完成:', result)
        })
      }

    } catch (error) {
      console.warn('Worker 文档分割失败，使用同步方法:', error)
      
      // Fallback to sync processing
      const { firstPageContent, overflowContent } = splitDocumentContent(doc, splitPoint)
      currentPageData.editor.commands.setContent(firstPageContent)
      currentPageData.isAutoPaginating = false
      await handleOverflowContent(pageIndex, overflowContent, false)
    }
  }, [visiblePages, isOptimizationEnabled, backgroundAnalyzeDocument])

  // Recursively handle overflow content
  const handleOverflowContent = useCallback(async (fromPageIndex: number, overflowNodes: any[], shouldMoveCursor: boolean = false) => {
    const nextPageIndex = fromPageIndex + 1

    // If next page exists, insert overflow content at beginning of next page
    if (nextPageIndex < visiblePages.length) {
      const nextPage = visiblePages[nextPageIndex]
      const nextPageNodes = documentToNodes(nextPage.editor.state.doc)

      try {
        // Use Worker for content merging (if available)
        const mergedContent = isOptimizationEnabled
          ? await mergeDocumentContentAsync(overflowNodes, nextPageNodes)
          : mergeDocumentContent(overflowNodes, nextPageNodes)

        // Update next page content
        nextPage.editor.commands.setContent(mergedContent)
      } catch (error) {
        console.warn('Worker 溢出内容合并失败，使用同步方法:', error)
        
        // Fallback to sync processing
        const mergedContent = mergeDocumentContent(overflowNodes, nextPageNodes)
        nextPage.editor.commands.setContent(mergedContent)
      }

      // If user is editing last content, move cursor to next page
      if (shouldMoveCursor) {
        setTimeout(() => {
          setCurrentPageIndex(nextPageIndex)
          moveCursorToStart(nextPage.editor)
        }, 0)
      }

    } else {
      try {
        // Use Worker to create new page content (if available)
        const newPageContent = isOptimizationEnabled
          ? await mergeDocumentContentAsync([], overflowNodes)
          : mergeDocumentContent([], overflowNodes)
        
        activateNextPage(newPageContent, shouldMoveCursor)
      } catch (error) {
        console.warn('Worker 新页面内容创建失败，使用同步方法:', error)
        
        // Fallback to sync processing
        const newPageContent = mergeDocumentContent([], overflowNodes)
        activateNextPage(newPageContent, shouldMoveCursor)
      }
    }
  }, [visiblePages, isOptimizationEnabled])

  // Activate next preloaded page
  const activateNextPage = useCallback((content: any = '<p></p>', shouldMoveCursor: boolean = false) => {
    expandPagePoolIfNeeded()
    // Get next page index
    const nextPageIndex = visiblePageCount
    // If next page index is less than preloaded page pool length, activate next page
    if (nextPageIndex < preloadedPagePool.length) {
      const nextPage = preloadedPagePool[nextPageIndex]
      // Activate next page
      activatePage(nextPage)
      // Update visible page count
      setVisiblePageCount(prev => prev + 1)
      // If need to move cursor, set current page index
      if (shouldMoveCursor) {
        setCurrentPageIndex(nextPageIndex)
      }
      
      if (shouldMoveCursor) {
        // Focus next page
        nextPage.editor.commands.focus()
      }
      
      setTimeout(() => {
        // Set next page content
        setEditorContentSafely(nextPage.editor, content)
        // If need to move cursor, move cursor to next page
        if (shouldMoveCursor) {
          setTimeout(() => {
            moveCursorToStart(nextPage.editor)
          }, 20)
        }
        
        setTimeout(() => {
          if (content.content && content.content.length > 3) {
            checkPageOverflow(nextPageIndex)
          }
        }, 100)
      }, 0)
    } else {
      console.warn('预创建页面池不足，立即扩容...')
      setPreloadedPagePool(prev => expandPagePool(
        prev, 
        handleEditorUpdate, 
        handleSelectionUpdate
      ))
      setTimeout(() => {
        activateNextPage(content, shouldMoveCursor)
      }, 0)
    }
  }, [expandPagePoolIfNeeded, visiblePageCount, preloadedPagePool, handleEditorUpdate, handleSelectionUpdate, checkPageOverflow])

  // Delete current empty page and select previous page
  const deleteCurrentEmptyPage = useCallback(() => {
    if (visiblePageCount <= 1) return
    
    const currentIndex = currentPageIndex
    if (currentIndex === 0) return
    
    const pageToHide = visiblePages[currentIndex]
    
    deactivatePage(pageToHide)
    setVisiblePageCount(prev => prev - 1)
    
    const newIndex = currentIndex - 1
    setCurrentPageIndex(newIndex)
    
    setTimeout(() => {
      currentEditor?.commands.focus()
    }, 0)
  }, [visiblePageCount, currentPageIndex, visiblePages, currentEditor])

  // Add new page
  const addNewPage = useCallback(() => {
    activateNextPage('<p></p>', true)
  }, [activateNextPage])

  // Delete page
  const deletePage = useCallback(() => {
    if (visiblePageCount <= 1) return
    
    const pageToHide = visiblePages[currentPageIndex]
    
    deactivatePage(pageToHide)
    
    const visiblePagesList = getVisiblePages(preloadedPagePool)
    setVisiblePageCount(visiblePagesList.length)
    
    if (currentPageIndex >= visiblePageCount - 1) {
      setCurrentPageIndex(visiblePageCount - 2)
    }
    
    setTimeout(() => {
      currentEditor?.commands.focus()
    }, 0)
  }, [visiblePageCount, visiblePages, currentPageIndex, preloadedPagePool, currentEditor])

  // Set current page
  const setCurrentPage = useCallback((index: number) => {
    const previousIndex = currentPageIndex
    setCurrentPageIndex(index)
    
    setTimeout(() => {
      currentEditor?.commands.focus()
      
      if (previousIndex !== index) {
        if (visiblePages[index]) {
          setTimeout(() => {
            checkPageOverflow(index)
          }, 0)
        }
      }
    }, 0)
  }, [currentPageIndex, currentEditor, visiblePages, checkPageOverflow])

  // Execute command to current editor
  const executeCommand = useCallback((command: string) => {
    if (!currentEditor) return
    
    switch (command) {
      case 'toggleBold':
        currentEditor.chain().focus().toggleBold().run()
        break
      case 'toggleItalic':
        currentEditor.chain().focus().toggleItalic().run()
        break
    }
  }, [currentEditor])

  // Check current editor state
  const isActive = useCallback((mark: string) => {
    return currentEditor?.isActive(mark) || false
  }, [currentEditor])

  // Reset page pagination count
  const resetPaginationCount = useCallback((pageIndex?: number) => {
    if (pageIndex !== undefined && visiblePages[pageIndex]) {
      const page = visiblePages[pageIndex]
      page.paginationCount = 0
      page.isAutoPaginating = false
    } else {
      visiblePages.forEach((page) => {
        page.paginationCount = 0
        page.isAutoPaginating = false
      })
    }
  }, [visiblePages])

  // Set page content ref
  const setPageContentRef = useCallback((el: HTMLElement | null, index: number) => {
    if (pageContentRefs.current.length <= index) {
      pageContentRefs.current.length = visiblePageCount
    }
    pageContentRefs.current[index] = el
  }, [visiblePageCount])

  // Initialize
  const initialize = useCallback(() => {
    preloadPages(PAGE_CONFIG.INITIAL_PRELOAD_COUNT)
    
    setTimeout(() => {
      if (preloadedPagePool.length > 0) {
        const firstPage = preloadedPagePool[0]
        const initialContent = `
          <h1>Tiptap 分页编辑器</h1>
          <p>基于现代前端技术栈构建的高性能智能分页富文本编辑器</p>
          
          <h2>🚀 核心技术栈</h2>
          <p>🔸 <strong>React</strong> - 现代化前端框架，Hooks API</p>
          <p>🔸 <strong>TypeScript</strong> - 类型安全的JavaScript超集</p>
          <p>🔸 <strong>Tiptap</strong> - 强大的富文本编辑器框架</p>
          <p>🔸 <strong>Tailwind CSS</strong> - 实用优先的CSS框架</p>
          <p>🔸 <strong>Vite</strong> - 下一代前端构建工具</p>
          
          <h2>✨ 核心特性</h2>
          <ul>
            <li><strong>智能分页</strong> - A4纸张模拟，自动内容溢出检测</li>
            <li><strong>预创建池</strong> - 编辑器实例池，85%性能提升</li>
            <li><strong>动态合并</strong> - 智能向上合并，空页面自动清理</li>
            <li><strong>光标跟随</strong> - 跨页面编辑时的智能光标定位</li>
            <li><strong>模块化架构</strong> - 代码拆分，易维护易测试</li>
          </ul>
          
          <h2>🏗️ 架构设计</h2>
          <blockquote>
            <p><strong>页面池管理</strong> - 预创建+动态扩容策略<br/>
            <strong>内容管理</strong> - 智能分割与合并算法<br/>
            <strong>光标控制</strong> - 跨页面无缝编辑体验<br/>
            <strong>溢出检测</strong> - 实时高度监控与自动分页</p>
          </blockquote>
          
          <h3>🎯 使用场景</h3>
          <p>适用于文档编辑、报告生成、内容管理系统等需要专业排版的应用场景。支持实时预览、打印友好的A4页面布局。</p>
          
          <p><em>开始在此处输入内容，体验流畅的智能分页效果...</em></p>
        `
        
        firstPage.editor.commands.setContent(initialContent)
        
        setTimeout(() => {
          firstPage.editor.commands.focus()
          
          setTimeout(() => {
            checkPageOverflow(0)
          }, 500)
        }, 0)
      }
    }, 100)
  }, [preloadPages, preloadedPagePool, checkPageOverflow])

  // Cleanup
  const cleanup = useCallback(() => {
    cleanupPagePool(preloadedPagePool)
    setPreloadedPagePool([])
  }, [preloadedPagePool])

  return {
    // State
    preloadedPagePool,
    visiblePageCount,
    currentPageIndex,
    pageContentRefs,
    
    // Computed
    visiblePages,
    currentEditor,
    currentPage,
    
    // Methods
    addNewPage,
    deletePage,
    setCurrentPage,
    executeCommand,
    isActive,
    resetPaginationCount,
    setPageContentRef,
    checkPageOverflow,
    initialize,
    cleanup,
    
    // Debug tools
    getPageSizeDebugInfo,
    analyzePageHeightRelation,
    debugOverflowTrigger,
    debugMergeAnalysis,
    trackCursorDuringMerge
  }
}