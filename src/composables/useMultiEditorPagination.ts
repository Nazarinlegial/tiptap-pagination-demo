import { ref, computed, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'

// 导入各个模块
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
  // 响应式数据
  const preloadedPagePool = ref<PageData[]>([])
  const visiblePageCount = ref(1)
  const currentPageIndex = ref(0)
  const pageContentRefs = ref<(HTMLElement | null)[]>([])

  // Worker 优化功能
  const { 
    isOptimizationEnabled,
    backgroundAnalyzeDocument,
    precalculatePagination,
    batchProcessContent 
  } = useWorkerOptimization()

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
      
      // 检测删除操作和光标位置
      const editorId = (editor as any).editorId
      const currentContentSize = editor.state.doc.content.size
      const previousContentSize = previousContentSizes.get(editorId) || 0
      const currentCursor = getCursorPosition(editor)
      const isDeleting = currentContentSize < previousContentSize
      const isAtBeginning = currentCursor.from <= 2
      const isNotFirstPage = activePageIndex > 0
      
      
      // 更新内容大小记录
      previousContentSizes.set(editorId, currentContentSize)
      
      // 如果在删除且光标在页面开头且不是第一页，移动到上一页末尾
      if (isDeleting && isAtBeginning && isNotFirstPage) {
        const visiblePagesArray = visiblePages.value
        const currentPageHasContent = editor.getText().trim().length > 0
        
        if (currentPageHasContent) {
          
          const previousPageIndex = activePageIndex - 1
          const previousPage = visiblePagesArray[previousPageIndex]
          
          if (previousPage) {
            currentPageIndex.value = previousPageIndex
            
            nextTick(() => {
              moveCursorToEnd(previousPage.editor)
            })
            
            return
          }
        }
      }
      
      // 检查空页面
      const isEmpty = isPageReallyEmpty(editor)
      const isFirstPage = activePageIndex === 0
      const hasMultiplePages = visiblePageCount.value > 1
      
      
      if (isEmpty && !isFirstPage && hasMultiplePages) {
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
    // 检查页面索引是否有效
    if (pageIndex < 0 || pageIndex >= visiblePagesArray.length) return
    
    // 获取当前页面数据
    const currentPageData = visiblePagesArray[pageIndex]
    if (!currentPageData) return

    // 获取页面内容元素
    const contentEl = pageContentRefs.value[pageIndex]
    if (!contentEl) return

    // 检查页面内容是否溢出
    const { hasOverflow, actualHeight } = checkPageOverflowState(contentEl)

    // 更新页面数据
    currentPageData.hasOverflow = hasOverflow
    currentPageData.contentHeight = actualHeight

    // 如果页面溢出且是当前页面，则进行分页
    if (hasOverflow && pageIndex === currentPageIndex.value) {
      // 获取页面分页次数
      const paginationCount = currentPageData.paginationCount || 0
      // 如果页面分页次数大于等于3次，则停止自动分页
      if (paginationCount >= 3) {
        return
      }

      // 如果页面正在自动分页，则不进行分页
      if (currentPageData.isAutoPaginating) {
        return
      }

      currentPageData.isAutoPaginating = true
      
      // 处理溢出内容
      nextTick(async () => {
        await handleOverflow(pageIndex)
      })
      
    } else if (!hasOverflow) {
      // 如果页面不溢出，则停止自动分页
      if (currentPageData) {
        currentPageData.isAutoPaginating = false
        currentPageData.paginationCount = 0
      }
      
      // 检查是否可以向上合并下一页内容
      checkForUpwardMerge(pageIndex, actualHeight).catch(error => {
        console.warn('向上合并检查失败:', error)
      })
    }
  }

  // 检查是否可以向上合并下一页内容
  const checkForUpwardMerge = async (pageIndex: number, currentHeight: number) => {
    const visiblePagesArray = visiblePages.value
    // 获取下一页索引
    const nextPageIndex = pageIndex + 1
    // 如果下一页索引超出页面池，则不进行合并
    if (nextPageIndex >= visiblePagesArray.length) return
    
    // 获取下一页数据
    const nextPage = visiblePagesArray[nextPageIndex]
    // 如果下一页不存在或不可见，则不进行合并
    if (!nextPage || !nextPage.isVisible) return
    
    // 获取下一页的DOM元素
    const nextPageElement = pageContentRefs.value[nextPageIndex]
    
    // 提取下一页的节点数据
    const nextPageNodes = extractNodeData(nextPage.editor)
    
    
    // 检查是否可以向上合并（传入节点数据和DOM元素）
    const { canMerge, nodesToMerge } = canMergeUpward(currentHeight, nextPageNodes, nextPageElement || undefined)
    // 如果可以合并，则合并下一页内容到当前页
    if (canMerge) {
      await mergeNextPageContent(pageIndex, nextPageIndex, nodesToMerge)
    }
  }

  // 合并下一页内容到当前页（支持 Worker 优化）
  const mergeNextPageContent = async (pageIndex: number, nextPageIndex: number, nodesToMerge: number) => {
    // 获取当前页面数据
    const visiblePagesArray = visiblePages.value
    // 获取当前页面
    const currentPage = visiblePagesArray[pageIndex]
    // 获取下一页数据
    const nextPage = visiblePagesArray[nextPageIndex]
    
    if (!currentPage || !nextPage) return
    
    // 保存光标位置信息
    let savedCursorInfo: { position: number, contentSize: number, isActive: boolean } | null = null
    const activePageIndex = currentPageIndex.value
    const isCurrentlyActiveEditor = pageIndex === activePageIndex
    
    // 如果当前页面是活动页面，保存详细的光标信息
    if (isCurrentlyActiveEditor) {
      const cursorPos = getCursorPosition(currentPage.editor)
      const currentContentSize = currentPage.editor.state.doc.content.size
      
      savedCursorInfo = {
        position: cursorPos.from,
        contentSize: currentContentSize,
        isActive: true
      }
      
             // 调试：记录合并前状态
       const beforeMerge = trackCursorDuringMerge(currentPage.editor, '合并前')
       console.log('🔍 合并前光标状态:', beforeMerge)
    }
    
    // 获取内容节点
    const currentNodes = documentToNodes(currentPage.editor.state.doc)
    // 获取下一页内容节点
    const nextNodes = documentToNodes(nextPage.editor.state.doc)
    // 分割下一页内容
    const { firstPart: nodesToMergeArray, secondPart: remainingNodes } = 
      splitNodesByCount(nextNodes, nodesToMerge)
    
    try {
      // 🚀 使用 Worker 进行内容合并（如果可用）
      const mergedContent = isOptimizationEnabled.value
        ? await mergeDocumentContentAsync(currentNodes, nodesToMergeArray)
        : mergeDocumentContent(currentNodes, nodesToMergeArray)
      
      // 更新当前页内容
      currentPage.editor.commands.setContent(mergedContent)
    } catch (error) {
      console.warn('Worker 内容合并失败，使用同步方法:', error)
      
      // 降级到同步处理
      const mergedContent = mergeDocumentContent(currentNodes, nodesToMergeArray)
      currentPage.editor.commands.setContent(mergedContent)
    }
    
    // 调试：记录内容更新后状态
    if (savedCursorInfo && savedCursorInfo.isActive) {
      setTimeout(() => {
        const afterContent = trackCursorDuringMerge(currentPage.editor, '内容更新后')
        console.log('📝 内容更新后光标状态:', afterContent)
      }, 10)
    }
    
    // 智能恢复光标位置
    if (savedCursorInfo && savedCursorInfo.isActive) {
      nextTick(() => {
        const newContentSize = currentPage.editor.state.doc.content.size
        
        // 光标位置应该保持在原始内容范围内，不受合并内容影响
        // 因为合并的内容是添加到当前内容之后的
        let targetPosition = savedCursorInfo.position
        
        // 确保位置在有效范围内
        const maxValidPosition = Math.min(savedCursorInfo.contentSize - 1, newContentSize - 1)
        targetPosition = Math.min(targetPosition, maxValidPosition)
        targetPosition = Math.max(1, targetPosition) // 至少在位置1
        
                 console.log(`🎯 光标位置计算: 原位置=${savedCursorInfo.position}, 目标位置=${targetPosition}, 新内容大小=${newContentSize}`)
         
         // 聚焦编辑器并设置光标位置
         currentPage.editor.commands.focus()
         currentPage.editor.commands.setTextSelection(targetPosition)
         
         // 调试：记录最终恢复后状态
         setTimeout(() => {
           const afterRestore = trackCursorDuringMerge(currentPage.editor, '光标恢复后')
           console.log('✅ 光标恢复后状态:', afterRestore)
         }, 20)
      })
    }
    
    // 更新下一页内容
    if (remainingNodes.length > 0) {
      try {
        // 🚀 使用 Worker 进行剩余内容合并（如果可用）
        const remainingContent = isOptimizationEnabled.value
          ? await mergeDocumentContentAsync([], remainingNodes)
          : mergeDocumentContent([], remainingNodes)
        
        // 更新下一页内容
        nextPage.editor.commands.setContent(remainingContent)
      } catch (error) {
        console.warn('Worker 剩余内容合并失败，使用同步方法:', error)
        
        // 降级到同步处理
        const remainingContent = mergeDocumentContent([], remainingNodes)
        nextPage.editor.commands.setContent(remainingContent)
      }
      
      
      // 递归检查下一页
      nextTick(() => {
        setTimeout(() => {
          checkPageOverflow(nextPageIndex)
        }, 100)
      })
      
    } else {
      // 隐藏空页面
      nextPage.isVisible = false
      clearEditorContent(nextPage.editor)
      
      const visiblePagesList = getVisiblePages(preloadedPagePool.value)
      visiblePageCount.value = visiblePagesList.length
    }
    
    // 重新检查当前页是否溢出（延迟执行，避免干扰光标位置）
    nextTick(() => {
      setTimeout(() => {
        // 只有当不是活动页面时才检查溢出，避免干扰用户正在编辑的页面
        if (pageIndex !== currentPageIndex.value) {
          checkPageOverflow(pageIndex)
        } else {
          // 如果是活动页面，延迟更久再检查，给光标恢复更多时间
          setTimeout(() => {
            checkPageOverflow(pageIndex)
          }, 300)
        }
      }, 100)
    })
  }

  // 处理内容溢出（支持 Worker 优化）
  const handleOverflow = async (pageIndex: number) => {
    // 获取当前页面数据
    const visiblePagesArray = visiblePages.value
    const currentPageData = visiblePagesArray[pageIndex]
    // 如果当前页面不存在或不溢出，则不进行分页
    if (!currentPageData || !currentPageData.hasOverflow) {
      if (currentPageData) {
        currentPageData.isAutoPaginating = false
      }
      return
    }

    // 更新页面分页次数
    currentPageData.paginationCount = (currentPageData.paginationCount || 0) + 1

    // 获取当前页面文档
    const doc = currentPageData.editor.state.doc
    // 获取当前页面文档节点数
    const nodeCount = doc.content.childCount

    // 保存当前光标位置
    const originalCursorPos = currentPageData.editor.state.selection.from

    // 计算分割点（始终按节点边界分割）
    const splitPoint = calculateSplitPoint(nodeCount)

    // 分析光标位置相对于分割点的关系
    const cursorAnalysis = analyzeCursorPosition(currentPageData.editor, splitPoint)

    try {
      // 🚀 使用 Worker 进行文档分割（如果可用）
      const splitResult = isOptimizationEnabled.value 
        ? await splitDocumentContentAsync(doc, splitPoint)
        : splitDocumentContent(doc, splitPoint)

      const { firstPageContent, overflowContent } = splitResult

      // 更新当前页面内容
      currentPageData.editor.commands.setContent(firstPageContent)
      currentPageData.isAutoPaginating = false

      // 根据光标分析结果处理光标位置
      if (cursorAnalysis.shouldPreserveCursor && cursorAnalysis.cursorInFirstPart) {
        // 光标在分割点之前，保持在原位置
        nextTick(() => {
          // 聚焦当前页面
          currentPageData.editor.commands.focus()
          // 获取当前页面文档节点数
          const newDocSize = currentPageData.editor.state.doc.content.size
          // 计算新的光标位置
          const newCursorPos = Math.min(originalCursorPos, newDocSize - 1)
          // 设置新的光标位置
          currentPageData.editor.commands.setTextSelection(newCursorPos)
        })
        
        // 不跳转到下一页
        await handleOverflowContent(pageIndex, overflowContent, false)
        
      } else {
        // 光标在分割点之后，或者用户在末尾编辑
        const shouldMoveCursor = shouldJumpToNextPage(currentPageData.editor)
        
        // 处理溢出内容，根据用户编辑上下文决定是否跳转
        await handleOverflowContent(pageIndex, overflowContent, shouldMoveCursor)
      }

      // 🚀 后台分析文档（如果启用了优化）
      if (isOptimizationEnabled.value && doc.content.childCount > 10) {
        backgroundAnalyzeDocument(doc, (result) => {
          console.log('📊 文档分析完成:', result)
        })
      }

    } catch (error) {
      console.warn('Worker 文档分割失败，使用同步方法:', error)
      
      // 降级到同步处理
      const { firstPageContent, overflowContent } = splitDocumentContent(doc, splitPoint)
      currentPageData.editor.commands.setContent(firstPageContent)
      currentPageData.isAutoPaginating = false
      await handleOverflowContent(pageIndex, overflowContent, false)
    }
  }

  // 递归处理溢出内容（支持 Worker 优化）
  const handleOverflowContent = async (fromPageIndex: number, overflowNodes: any[], shouldMoveCursor: boolean = false) => {
    const nextPageIndex = fromPageIndex + 1
    const visiblePagesArray = visiblePages.value

    // 如果下一页存在，将溢出内容插入到下一页开头
    if (nextPageIndex < visiblePagesArray.length) {
      const nextPage = visiblePagesArray[nextPageIndex]
      const nextPageNodes = documentToNodes(nextPage.editor.state.doc)

      try {
        // 🚀 使用 Worker 进行内容合并（如果可用）
        const mergedContent = isOptimizationEnabled.value
          ? await mergeDocumentContentAsync(overflowNodes, nextPageNodes)
          : mergeDocumentContent(overflowNodes, nextPageNodes)

        // 更新下一页内容
        nextPage.editor.commands.setContent(mergedContent)
      } catch (error) {
        console.warn('Worker 溢出内容合并失败，使用同步方法:', error)
        
        // 降级到同步处理
        const mergedContent = mergeDocumentContent(overflowNodes, nextPageNodes)
        nextPage.editor.commands.setContent(mergedContent)
      }

      // 如果用户在编辑最后的内容，移动光标到下一页
      if (shouldMoveCursor) {
        nextTick(() => {
          currentPageIndex.value = nextPageIndex
          moveCursorToStart(nextPage.editor)
        })
      }

    } else {
      try {
        // 🚀 使用 Worker 创建新页面内容（如果可用）
        const newPageContent = isOptimizationEnabled.value
          ? await mergeDocumentContentAsync([], overflowNodes)
          : mergeDocumentContent([], overflowNodes)
        
        activateNextPage(newPageContent, shouldMoveCursor)
      } catch (error) {
        console.warn('Worker 新页面内容创建失败，使用同步方法:', error)
        
        // 降级到同步处理
        const newPageContent = mergeDocumentContent([], overflowNodes)
        activateNextPage(newPageContent, shouldMoveCursor)
      }
    }
  }

  // 激活下一个预创建的页面
  const activateNextPage = (content: any = '<p></p>', shouldMoveCursor: boolean = false) => {
    expandPagePoolIfNeeded()
    // 获取下一个页面索引
    const nextPageIndex = visiblePageCount.value
    // 如果下一个页面索引小于预创建页面池长度，则激活下一个页面
    if (nextPageIndex < preloadedPagePool.value.length) {
      const nextPage = preloadedPagePool.value[nextPageIndex]
      // 激活下一个页面
      activatePage(nextPage)
      // 更新可见页面数
      visiblePageCount.value++
      // 如果需要移动光标，则设置当前页面索引
      if (shouldMoveCursor) {
        currentPageIndex.value = nextPageIndex
      }
      
      
      if (shouldMoveCursor) {
        // 聚焦下一个页面
        nextPage.editor.commands.focus()
      }
      
      nextTick(() => {
        // 设置下一个页面内容
        setEditorContentSafely(nextPage.editor, content)
        // 如果需要移动光标，则移动光标到下一个页面
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
    
    
    deactivatePage(pageToHide)
    visiblePageCount.value--
    
    const newIndex = currentIndex - 1
    currentPageIndex.value = newIndex
    
    
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
    
    
    nextTick(() => {
      currentEditor.value?.commands.focus()
    })
  }

  // 设置当前页面
  const setCurrentPage = (index: number) => {
    const previousIndex = currentPageIndex.value
    currentPageIndex.value = index
    
    nextTick(() => {
      currentEditor.value?.commands.focus()
      
      if (previousIndex !== index) {
        const visiblePagesArray = visiblePages.value
        if (visiblePagesArray[index]) {
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
    } else {
      visiblePagesArray.forEach((page, index) => {
        page.paginationCount = 0
        page.isAutoPaginating = false
      })
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
    cleanup,
    
    // 调试工具
    getPageSizeDebugInfo,
    analyzePageHeightRelation,
    debugOverflowTrigger,
    debugMergeAnalysis,
    trackCursorDuringMerge
  }
} 