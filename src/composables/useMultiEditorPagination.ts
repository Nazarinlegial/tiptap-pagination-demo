import { ref, computed, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'

// 导入各个模块
import { 
  PAGE_CONFIG, 
  isPageReallyEmpty, 
  checkPageOverflowState, 
  canMergeUpward, 
  calculateSplitPoint, 
  isDeletingAtBeginning 
} from './pageCalculations'

import { 
  splitDocumentContent, 
  mergeDocumentContent, 
  documentToNodes, 
  splitNodesByCount, 
  createEmptyDocument,
  analyzeCursorPosition 
} from './contentManagement'

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
  // 响应式数据
  const preloadedPagePool = ref<PageData[]>([])
  const visiblePageCount = ref(1)
  const currentPageIndex = ref(0)
  const pageContentRefs = ref<(HTMLElement | null)[]>([])

  // 计算属性
  const visiblePages = computed(() => {
    return getVisiblePages(preloadedPagePool.value, visiblePageCount.value)
  })

  const currentEditor = computed(() => {
    const visiblePagesArray = visiblePages.value
    return visiblePagesArray[currentPageIndex.value]?.editor
  })

  const currentPage = computed(() => {
    const visiblePagesArray = visiblePages.value
    return visiblePagesArray[currentPageIndex.value]
  })

  // 用于检测删除操作的状态
  let previousContentSizes = new Map<string, number>()

  // 编辑器更新回调
  const handleEditorUpdate = (editor: any) => {
    const activePageIndex = currentPageIndex.value
    if (activePageIndex === -1) return

    nextTick(() => {
      console.log(`Content updated in active page ${activePageIndex + 1}, checking overflow...`)
      
      // 检测删除操作和光标位置
      const editorId = (editor as any).editorId
      const currentContentSize = editor.state.doc.content.size
      const previousContentSize = previousContentSizes.get(editorId) || 0
      const currentCursor = getCursorPosition(editor)
      const isDeleting = currentContentSize < previousContentSize
      const isAtBeginning = currentCursor.from <= 2
      const isNotFirstPage = activePageIndex > 0
      
      console.log(`Delete analysis: isDeleting=${isDeleting}, cursorPosition=${currentCursor.from}, isAtBeginning=${isAtBeginning}, isNotFirstPage=${isNotFirstPage}`)
      
      // 更新内容大小记录
      previousContentSizes.set(editorId, currentContentSize)
      
      // 如果在删除且光标在页面开头且不是第一页，移动到上一页末尾
      if (isDeleting && isAtBeginning && isNotFirstPage) {
        const visiblePagesArray = visiblePages.value
        const currentPageHasContent = editor.getText().trim().length > 0
        
        if (currentPageHasContent) {
          console.log(`Moving cursor to previous page ${activePageIndex} due to deletion at beginning`)
          
          const previousPageIndex = activePageIndex - 1
          const previousPage = visiblePagesArray[previousPageIndex]
          
          if (previousPage) {
            currentPageIndex.value = previousPageIndex
            
            nextTick(() => {
              moveCursorToEnd(previousPage.editor)
              console.log(`Cursor moved to end of page ${previousPageIndex + 1}`)
            })
            
            return
          }
        }
      }
      
      // 检查空页面
      const isEmpty = isPageReallyEmpty(editor)
      const isFirstPage = activePageIndex === 0
      const hasMultiplePages = visiblePageCount.value > 1
      
      console.log(`Page ${activePageIndex + 1} empty check: isEmpty=${isEmpty}, textLength=${editor.getText().trim().length}`)
      
      if (isEmpty && !isFirstPage && hasMultiplePages) {
        console.log(`Page ${activePageIndex + 1} is truly empty, deleting and moving to previous page`)
        deleteCurrentEmptyPage()
        return
      }
      
      checkPageOverflow(activePageIndex)
    })
  }

  // 编辑器选择更新回调
  const handleSelectionUpdate = (editor: any) => {
    const editorElement = editor.view.dom
    const dataEditorId = editorElement.getAttribute('data-editor-id')
    if (dataEditorId) {
      const visiblePagesArray = visiblePages.value
      const pageIndex = visiblePagesArray.findIndex(p => p.editorId === dataEditorId)
      if (pageIndex !== -1 && pageIndex !== currentPageIndex.value) {
        console.log(`Selection switched to page ${pageIndex + 1}`)
        currentPageIndex.value = pageIndex
      }
    }
  }

  // 预创建页面池
  const preloadPages = (count: number) => {
    const newPages = createPagePool(count, handleEditorUpdate, handleSelectionUpdate)
    preloadedPagePool.value.push(...newPages)
  }

  // 动态扩容页面池
  const expandPagePoolIfNeeded = () => {
    if (shouldExpandPool(visiblePageCount.value, preloadedPagePool.value.length)) {
      console.log(`触发动态扩容，当前池大小: ${preloadedPagePool.value.length}`)
      
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          preloadedPagePool.value = expandPagePool(
            preloadedPagePool.value, 
            handleEditorUpdate, 
            handleSelectionUpdate
          )
        })
      } else {
        setTimeout(() => {
          preloadedPagePool.value = expandPagePool(
            preloadedPagePool.value, 
            handleEditorUpdate, 
            handleSelectionUpdate
          )
        }, 0)
      }
    }
  }

  // 检查页面内容是否溢出
  const checkPageOverflow = (pageIndex: number) => {
    const visiblePagesArray = visiblePages.value
    if (pageIndex < 0 || pageIndex >= visiblePagesArray.length) return
    
    const currentPageData = visiblePagesArray[pageIndex]
    if (!currentPageData) return

    const contentEl = pageContentRefs.value[pageIndex]
    if (!contentEl) return

    const { hasOverflow, actualHeight } = checkPageOverflowState(contentEl)

    currentPageData.hasOverflow = hasOverflow
    currentPageData.contentHeight = actualHeight

    console.log(`Page ${pageIndex + 1}: height=${actualHeight}, overflow=${hasOverflow}`)

    if (hasOverflow && pageIndex === currentPageIndex.value) {
      const paginationCount = currentPageData.paginationCount || 0
      
      if (paginationCount >= 3) {
        console.warn(`Page ${pageIndex + 1} has been paginated ${paginationCount} times, stopping auto-pagination`)
        return
      }

      if (currentPageData.isAutoPaginating) {
        return
      }

      console.log(`Content overflow detected, immediately paginating page ${pageIndex + 1}`)
      currentPageData.isAutoPaginating = true
      
      nextTick(() => {
        handleOverflow(pageIndex)
      })
      
    } else if (!hasOverflow) {
      if (currentPageData) {
        currentPageData.isAutoPaginating = false
        currentPageData.paginationCount = 0
      }
      
      // 检查是否可以向上合并下一页内容
      checkForUpwardMerge(pageIndex, actualHeight)
    }
  }

  // 检查是否可以向上合并下一页内容
  const checkForUpwardMerge = (pageIndex: number, currentHeight: number) => {
    const visiblePagesArray = visiblePages.value
    const nextPageIndex = pageIndex + 1
    
    if (nextPageIndex >= visiblePagesArray.length) return
    
    const nextPage = visiblePagesArray[nextPageIndex]
    if (!nextPage || !nextPage.isVisible) return
    
    const nextPageDoc = nextPage.editor.state.doc
    const nextPageNodeCount = nextPageDoc.content.childCount
    
    const { canMerge, nodesToMerge } = canMergeUpward(currentHeight, nextPageNodeCount)
    
    if (canMerge) {
      console.log(`Attempting to merge ${nodesToMerge} nodes from page ${nextPageIndex + 1} to page ${pageIndex + 1}`)
      mergeNextPageContent(pageIndex, nextPageIndex, nodesToMerge)
    }
  }

  // 合并下一页内容到当前页
  const mergeNextPageContent = (pageIndex: number, nextPageIndex: number, nodesToMerge: number) => {
    const visiblePagesArray = visiblePages.value
    const currentPage = visiblePagesArray[pageIndex]
    const nextPage = visiblePagesArray[nextPageIndex]
    
    if (!currentPage || !nextPage) return
    
    // 保存当前光标位置
    let savedCursorPosition = 0
    const activePageIndex = currentPageIndex.value
    const isCurrentlyActiveEditor = pageIndex === activePageIndex
    if (isCurrentlyActiveEditor) {
      savedCursorPosition = getCursorPosition(currentPage.editor).from
      console.log(`Saving cursor position: ${savedCursorPosition} before merge`)
    }
    
    // 获取内容节点
    const currentNodes = documentToNodes(currentPage.editor.state.doc)
    const nextNodes = documentToNodes(nextPage.editor.state.doc)
    
    const { firstPart: nodesToMergeArray, secondPart: remainingNodes } = 
      splitNodesByCount(nextNodes, nodesToMerge)
    
    // 合并内容
    const mergedContent = mergeDocumentContent(currentNodes, nodesToMergeArray)
    
    // 更新当前页内容
    currentPage.editor.commands.setContent(mergedContent)
    
    // 恢复光标位置
    if (isCurrentlyActiveEditor) {
      nextTick(() => {
        restoreCursorPosition(currentPage.editor, savedCursorPosition)
      })
    }
    
    // 更新下一页内容
    if (remainingNodes.length > 0) {
      const remainingContent = mergeDocumentContent([], remainingNodes)
      nextPage.editor.commands.setContent(remainingContent)
      
      console.log(`Merged ${nodesToMerge} nodes from page ${nextPageIndex + 1} to page ${pageIndex + 1}`)
      
      // 递归检查下一页
      nextTick(() => {
        setTimeout(() => {
          console.log(`Recursively checking page ${nextPageIndex + 1} for further merging`)
          checkPageOverflow(nextPageIndex)
        }, 100)
      })
      
    } else {
      // 隐藏空页面
      console.log(`All content from page ${nextPageIndex + 1} merged, hiding empty page`)
      nextPage.isVisible = false
      clearEditorContent(nextPage.editor)
      
      const visiblePagesList = getVisiblePages(preloadedPagePool.value)
      visiblePageCount.value = visiblePagesList.length
    }
    
    // 重新检查当前页是否溢出
    nextTick(() => {
      setTimeout(() => {
        console.log(`Checking page ${pageIndex + 1} for overflow after merge`)
        checkPageOverflow(pageIndex)
      }, 150)
    })
  }

  // 处理内容溢出
  const handleOverflow = (pageIndex: number) => {
    const visiblePagesArray = visiblePages.value
    const currentPageData = visiblePagesArray[pageIndex]
    if (!currentPageData || !currentPageData.hasOverflow) {
      if (currentPageData) {
        currentPageData.isAutoPaginating = false
      }
      return
    }

    currentPageData.paginationCount = (currentPageData.paginationCount || 0) + 1

    const doc = currentPageData.editor.state.doc
    const nodeCount = doc.content.childCount

    // 保存当前光标位置
    const originalCursorPos = currentPageData.editor.state.selection.from

    // 计算分割点（始终按节点边界分割）
    const splitPoint = calculateSplitPoint(nodeCount)

    console.log(`Splitting page ${pageIndex + 1}: total nodes=${nodeCount}, keeping first ${splitPoint} nodes`)

    // 分析光标位置相对于分割点的关系
    const cursorAnalysis = analyzeCursorPosition(currentPageData.editor, splitPoint)

    // 分割内容
    const { firstPageContent, overflowContent } = splitDocumentContent(doc, splitPoint)

    // 更新当前页面内容
    currentPageData.editor.commands.setContent(firstPageContent)
    currentPageData.isAutoPaginating = false

    // 根据光标分析结果处理光标位置
    if (cursorAnalysis.shouldPreserveCursor && cursorAnalysis.cursorInFirstPart) {
      // 光标在分割点之前，保持在原位置
      nextTick(() => {
        currentPageData.editor.commands.focus()
        const newDocSize = currentPageData.editor.state.doc.content.size
        const newCursorPos = Math.min(originalCursorPos, newDocSize - 1)
        currentPageData.editor.commands.setTextSelection(newCursorPos)
        console.log(`Cursor preserved at position ${newCursorPos} (was in first part)`)
      })
      
      // 不跳转到下一页
      handleOverflowContent(pageIndex, overflowContent, false)
      
    } else {
      // 光标在分割点之后，或者用户在末尾编辑
      const shouldMoveCursor = shouldJumpToNextPage(currentPageData.editor)
      
      console.log(`Cursor was in overflow part, shouldMoveCursor=${shouldMoveCursor}`)
      
      // 处理溢出内容，根据用户编辑上下文决定是否跳转
      handleOverflowContent(pageIndex, overflowContent, shouldMoveCursor)
    }
  }

  // 递归处理溢出内容
  const handleOverflowContent = (fromPageIndex: number, overflowNodes: any[], shouldMoveCursor: boolean = false) => {
    const nextPageIndex = fromPageIndex + 1
    const visiblePagesArray = visiblePages.value

    // 如果下一页存在，将溢出内容插入到下一页开头
    if (nextPageIndex < visiblePagesArray.length) {
      const nextPage = visiblePagesArray[nextPageIndex]
      const nextPageNodes = documentToNodes(nextPage.editor.state.doc)

      // 合并内容：溢出内容 + 原有内容
      const mergedContent = mergeDocumentContent(overflowNodes, nextPageNodes)

      console.log(`Inserting ${overflowNodes.length} nodes to existing page ${nextPageIndex + 1}`)

      // 更新下一页内容
      nextPage.editor.commands.setContent(mergedContent)

      // 如果用户在编辑最后的内容，移动光标到下一页
      if (shouldMoveCursor) {
        nextTick(() => {
          console.log(`Moving cursor to page ${nextPageIndex + 1} after pagination`)
          currentPageIndex.value = nextPageIndex
          moveCursorToStart(nextPage.editor)
        })
      }

    } else {
      // 创建新页面
      const newPageContent = mergeDocumentContent([], overflowNodes)
      console.log(`Creating new page for ${overflowNodes.length} overflow nodes`)
      activateNextPage(newPageContent, shouldMoveCursor)
    }
  }

  // 激活下一个预创建的页面
  const activateNextPage = (content: any = '<p></p>', shouldMoveCursor: boolean = false) => {
    expandPagePoolIfNeeded()
    
    const nextPageIndex = visiblePageCount.value
    if (nextPageIndex < preloadedPagePool.value.length) {
      const nextPage = preloadedPagePool.value[nextPageIndex]
      
      activatePage(nextPage)
      visiblePageCount.value++
      
      if (shouldMoveCursor) {
        currentPageIndex.value = nextPageIndex
      }
      
      console.log(`激活预创建页面 ${nextPageIndex + 1}，当前可见页面数: ${visiblePageCount.value}`)
      
      if (shouldMoveCursor) {
        nextPage.editor.commands.focus()
      }
      
      nextTick(() => {
        setEditorContentSafely(nextPage.editor, content)
        
        if (shouldMoveCursor) {
          setTimeout(() => {
            moveCursorToStart(nextPage.editor)
            console.log(`Cursor moved to new page ${nextPageIndex + 1}`)
          }, 20)
        }
        
        setTimeout(() => {
          if (content.content && content.content.length > 3) {
            console.log(`Checking overflow for newly activated page with content`)
            checkPageOverflow(nextPageIndex)
          }
        }, 100)
      })
    } else {
      console.warn('预创建页面池不足，立即扩容...')
      preloadedPagePool.value = expandPagePool(
        preloadedPagePool.value, 
        handleEditorUpdate, 
        handleSelectionUpdate
      )
      nextTick(() => {
        activateNextPage(content, shouldMoveCursor)
      })
    }
  }

  // 删除当前空页面并选中上一页
  const deleteCurrentEmptyPage = () => {
    if (visiblePageCount.value <= 1) return
    
    const currentIndex = currentPageIndex.value
    if (currentIndex === 0) return
    
    const visiblePagesArray = visiblePages.value
    const pageToHide = visiblePagesArray[currentIndex]
    
    console.log(`Deleting empty page ${currentIndex + 1}`)
    
    deactivatePage(pageToHide)
    visiblePageCount.value--
    
    const newIndex = currentIndex - 1
    currentPageIndex.value = newIndex
    
    console.log(`Moved to previous page ${newIndex + 1}, visible pages: ${visiblePageCount.value}`)
    
    nextTick(() => {
      currentEditor.value?.commands.focus()
    })
  }

  // 添加新页面
  const addNewPage = () => {
    activateNextPage('<p></p>', true)
  }

  // 删除页面
  const deletePage = () => {
    if (visiblePageCount.value <= 1) return
    
    const visiblePagesArray = visiblePages.value
    const pageToHide = visiblePagesArray[currentPageIndex.value]
    
    deactivatePage(pageToHide)
    
    const visiblePagesList = getVisiblePages(preloadedPagePool.value)
    visiblePageCount.value = visiblePagesList.length
    
    if (currentPageIndex.value >= visiblePageCount.value) {
      currentPageIndex.value = visiblePageCount.value - 1
    }
    
    console.log(`隐藏页面，当前可见页面数: ${visiblePageCount.value}`)
    
    nextTick(() => {
      currentEditor.value?.commands.focus()
    })
  }

  // 设置当前页面
  const setCurrentPage = (index: number) => {
    const previousIndex = currentPageIndex.value
    console.log(`Switching from page ${previousIndex + 1} to page ${index + 1}`)
    currentPageIndex.value = index
    
    nextTick(() => {
      currentEditor.value?.commands.focus()
      
      if (previousIndex !== index) {
        const visiblePagesArray = visiblePages.value
        if (visiblePagesArray[index]) {
          console.log(`Switched to page ${index + 1}, checking its overflow status...`)
          nextTick(() => {
            checkPageOverflow(index)
          })
        }
      }
    })
  }

  // 执行命令到当前编辑器
  const executeCommand = (command: string) => {
    if (!currentEditor.value) return
    
    switch (command) {
      case 'toggleBold':
        currentEditor.value.chain().focus().toggleBold().run()
        break
      case 'toggleItalic':
        currentEditor.value.chain().focus().toggleItalic().run()
        break
    }
  }

  // 检查当前编辑器状态
  const isActive = (mark: string) => {
    return currentEditor.value?.isActive(mark) || false
  }

  // 重置页面分页计数
  const resetPaginationCount = (pageIndex?: number) => {
    const visiblePagesArray = visiblePages.value
    if (pageIndex !== undefined && visiblePagesArray[pageIndex]) {
      const page = visiblePagesArray[pageIndex]
      page.paginationCount = 0
      page.isAutoPaginating = false
      console.log(`Reset pagination count for page ${pageIndex + 1}`)
    } else {
      visiblePagesArray.forEach((page, index) => {
        page.paginationCount = 0
        page.isAutoPaginating = false
      })
      console.log('Reset pagination count for all visible pages')
    }
  }

  // 设置页面内容引用
  const setPageContentRef = (el: Element | ComponentPublicInstance | null, index: number) => {
    if (pageContentRefs.value.length <= index) {
      pageContentRefs.value.length = visiblePageCount.value
    }
    pageContentRefs.value[index] = el as HTMLElement | null
  }

  // 初始化
  const initialize = () => {
    console.log('多编辑器分页系统初始化中...')
    
    preloadPages(PAGE_CONFIG.INITIAL_PRELOAD_COUNT)
    
    if (preloadedPagePool.value.length > 0) {
      const firstPage = preloadedPagePool.value[0]
      const initialContent = `
        <h1>Tiptap 分页编辑器</h1>
        <p>基于现代前端技术栈构建的高性能智能分页富文本编辑器</p>
        
        <h2>🚀 核心技术栈</h2>
        <p>🔸 <strong>Vue 3</strong> - 渐进式前端框架，Composition API</p>
        <p>🔸 <strong>TypeScript</strong> - 类型安全的JavaScript超集</p>
        <p>🔸 <strong>Tiptap</strong> - 强大的富文本编辑器框架</p>
        <p>🔸 <strong>Element Plus</strong> - 企业级Vue组件库</p>
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
      
      nextTick(() => {
        firstPage.editor.commands.focus()
        
        setTimeout(() => {
          checkPageOverflow(0)
        }, 500)
      })
    }
  }

  // 清理
  const cleanup = () => {
    cleanupPagePool(preloadedPagePool.value)
    preloadedPagePool.value = []
  }

  return {
    // 响应式数据
    preloadedPagePool,
    visiblePageCount,
    currentPageIndex,
    pageContentRefs,
    
    // 计算属性
    visiblePages,
    currentEditor,
    currentPage,
    
    // 方法
    addNewPage,
    deletePage,
    setCurrentPage,
    executeCommand,
    isActive,
    resetPaginationCount,
    setPageContentRef,
    checkPageOverflow,
    initialize,
    cleanup
  }
} 