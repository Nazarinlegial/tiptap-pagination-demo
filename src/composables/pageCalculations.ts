// 页面计算相关的工具函数

export const PAGE_CONFIG = {
  A4_HEIGHT: 1123,
  A4_WIDTH: 794,
  PAGE_MARGIN: 60,
  PAGE_NUMBER_HEIGHT: 40,
  // 实际可用内容高度：A4总高度 - 上下padding(120px) - 页码区域(40px) - 安全缓冲(20px)
  CONTENT_MAX_HEIGHT: 1123 - (60 * 2) - 40 - 20, // 943px -> 理论值963px，但保留20px缓冲
  // 如果需要更精确，可以调整为：1123 - 120 - 40 - 10 = 953px
  INITIAL_PRELOAD_COUNT: 5,
  EXPAND_THRESHOLD: 4,
  EXPAND_COUNT: 5
}

// 检查页面是否真正为空（更严格的判断）
export const isPageReallyEmpty = (editor: any): boolean => {
  const textContent = editor.getText().trim()
  
  if (textContent.length > 0) {
    return false
  }
  
  const doc = editor.state.doc
  
  if (doc.content.childCount === 0) {
    return true
  }
  
  if (doc.content.childCount === 1) {
    const firstNode = doc.content.firstChild
    if (firstNode && firstNode.type.name === 'paragraph') {
      const paragraphText = firstNode.textContent.trim()
      const hasOnlyLineBreak = firstNode.content.size === 0 || 
                             (firstNode.content.size === 1 && firstNode.textContent === '')
      
      return paragraphText.length === 0 && hasOnlyLineBreak
    }
  }
  
  return false
}

// 计算元素的完整尺寸信息
interface ElementSizeInfo {
  contentHeight: number
  paddingTop: number
  paddingBottom: number
  borderTop: number
  borderBottom: number
  marginTop: number
  marginBottom: number
  totalHeight: number
}

// 获取元素的详细尺寸信息
const getElementSizeInfo = (element: HTMLElement): ElementSizeInfo => {
  const computedStyle = window.getComputedStyle(element)
  
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
  const borderTop = parseFloat(computedStyle.borderTopWidth) || 0
  const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0
  const marginTop = parseFloat(computedStyle.marginTop) || 0
  const marginBottom = parseFloat(computedStyle.marginBottom) || 0
  
  // 内容高度（不包括padding和border）
  const contentHeight = element.scrollHeight
  
  // 总高度（包括所有间距）
  const totalHeight = contentHeight + paddingTop + paddingBottom + borderTop + borderBottom + marginTop + marginBottom
  
  return {
    contentHeight,
    paddingTop,
    paddingBottom,
    borderTop,
    borderBottom,
    marginTop,
    marginBottom,
    totalHeight
  }
}

// 检查页面是否溢出
export const checkPageOverflowState = (pageElement: HTMLElement): { hasOverflow: boolean, actualHeight: number } => {
  // 获取页面元素中的ProseMirror元素
  const pmEl = pageElement.querySelector('.ProseMirror') as HTMLElement | null
  // 如果ProseMirror元素不存在，则认为页面不溢出
  if (!pmEl) {
    return { hasOverflow: false, actualHeight: 0 }
  }

  // 直接使用ProseMirror元素的scrollHeight作为内容高度
  // 这是最准确的内容高度，不包含重复的间距计算
  const actualContentHeight = pmEl.scrollHeight
  
  // 获取溢出阈值（移除过度的缓冲空间）
  const OVERFLOW_THRESHOLD = PAGE_CONFIG.CONTENT_MAX_HEIGHT
  const BUFFER_SPACE = 10 // 减少缓冲空间，避免过早分页
  
  // 检查是否溢出：只比较ProseMirror的实际内容高度与配置的最大高度
  const hasOverflow = actualContentHeight > (OVERFLOW_THRESHOLD - BUFFER_SPACE)
  
  // 调试信息
  if (hasOverflow) {
    console.log(`页面溢出检测: 内容高度=${actualContentHeight}px, 阈值=${OVERFLOW_THRESHOLD - BUFFER_SPACE}px`)
  }
  
  return { hasOverflow, actualHeight: actualContentHeight }
}

// 调试函数：实时分析分页触发原因
export const debugOverflowTrigger = (pageElement: HTMLElement): object => {
  const pmEl = pageElement.querySelector('.ProseMirror') as HTMLElement | null
  
  if (!pmEl) {
    return { error: 'ProseMirror element not found' }
  }
  
  const actualContentHeight = pmEl.scrollHeight
  const OVERFLOW_THRESHOLD = PAGE_CONFIG.CONTENT_MAX_HEIGHT
  const BUFFER_SPACE = 10
  const effectiveThreshold = OVERFLOW_THRESHOLD - BUFFER_SPACE
  
  const isOverflowing = actualContentHeight > effectiveThreshold
  const remainingSpace = effectiveThreshold - actualContentHeight
  
  return {
    measurements: {
      proseMirrorScrollHeight: actualContentHeight,
      configuredMaxHeight: OVERFLOW_THRESHOLD,
      bufferSpace: BUFFER_SPACE,
      effectiveThreshold: effectiveThreshold,
      remainingSpace: remainingSpace
    },
    status: {
      isOverflowing: isOverflowing,
      utilizationPercent: Math.round((actualContentHeight / effectiveThreshold) * 100),
      message: isOverflowing 
        ? `🔴 页面溢出！内容高度 ${actualContentHeight}px 超过阈值 ${effectiveThreshold}px`
        : `🟢 页面正常，还可增加 ${remainingSpace}px 内容`
    },
    breakdown: {
      expectedMaxContent: `${OVERFLOW_THRESHOLD}px (配置值)`,
      actualBuffer: `${BUFFER_SPACE}px (避免边界问题)`,
      realThreshold: `${effectiveThreshold}px (实际阈值)`,
      currentContent: `${actualContentHeight}px (当前内容)`,
      difference: `${actualContentHeight - effectiveThreshold}px (超出部分)`
    }
  }
}

// 调试函数：分析A4页面和内容区域的高度关系
export const analyzePageHeightRelation = (pageWrapperElement: HTMLElement): object => {
  const a4PageEl = pageWrapperElement.querySelector('.a4-page') as HTMLElement | null
  const pageContentEl = pageWrapperElement.querySelector('.page-content') as HTMLElement | null
  const pmEl = pageWrapperElement.querySelector('.ProseMirror') as HTMLElement | null
  const pageNumberEl = pageWrapperElement.querySelector('.page-number') as HTMLElement | null
  
  if (!a4PageEl || !pageContentEl || !pmEl) {
    return { error: 'Required elements not found' }
  }
  
  const a4PageInfo = getElementSizeInfo(a4PageEl)
  const pageContentInfo = getElementSizeInfo(pageContentEl)
  const pmInfo = getElementSizeInfo(pmEl)
  const pageNumberInfo = pageNumberEl ? getElementSizeInfo(pageNumberEl) : null
  
  // 计算各部分实际占用的高度
  const pageContentActualHeight = pageContentInfo.totalHeight
  const pageNumberHeight = pageNumberInfo ? pageNumberInfo.totalHeight : 0
  const remainingA4Space = a4PageInfo.contentHeight - pageContentActualHeight - pageNumberHeight
  
  return {
    elements: {
      a4Page: {
        ...a4PageInfo,
        description: 'A4页面容器 (.a4-page)',
        cssHeight: getComputedStyle(a4PageEl).height,
        cssMinHeight: getComputedStyle(a4PageEl).minHeight
      },
      pageContent: {
        ...pageContentInfo,
        description: '页面内容区域 (.page-content)',
        cssHeight: getComputedStyle(pageContentEl).height,
        cssMinHeight: getComputedStyle(pageContentEl).minHeight,
        cssMaxHeight: getComputedStyle(pageContentEl).maxHeight
      },
      proseMirror: {
        ...pmInfo,
        description: 'ProseMirror编辑器区域',
        cssHeight: getComputedStyle(pmEl).height
      },
      pageNumber: pageNumberInfo ? {
        ...pageNumberInfo,
        description: '页码区域 (.page-number)'
      } : null
    },
    
    config: {
      expectedA4Height: PAGE_CONFIG.A4_HEIGHT,
      expectedContentMaxHeight: PAGE_CONFIG.CONTENT_MAX_HEIGHT,
      expectedPageMargin: PAGE_CONFIG.PAGE_MARGIN,
      expectedPageNumberHeight: PAGE_CONFIG.PAGE_NUMBER_HEIGHT
    },
    
    analysis: {
      heightDifference: a4PageInfo.contentHeight - pageContentActualHeight,
      pageContentUtilization: `${((pageContentActualHeight / a4PageInfo.contentHeight) * 100).toFixed(1)}%`,
      remainingA4Space: remainingA4Space,
      isContentOverflowing: pmInfo.contentHeight > PAGE_CONFIG.CONTENT_MAX_HEIGHT,
      contentVsConfigRatio: `${((pmInfo.contentHeight / PAGE_CONFIG.CONTENT_MAX_HEIGHT) * 100).toFixed(1)}%`,
      
      // 详细的高度分解
      breakdown: {
        a4TotalHeight: a4PageInfo.contentHeight,
        pageContentHeight: pageContentActualHeight,
        pageContentPadding: pageContentInfo.paddingTop + pageContentInfo.paddingBottom,
        proseMirrorHeight: pmInfo.contentHeight,
        pageNumberHeight: pageNumberHeight,
        unaccountedSpace: remainingA4Space
      },
      
      recommendations: []
    }
  }
}

// 调试函数：获取页面详细的尺寸信息 (保留原有功能)
export const getPageSizeDebugInfo = (pageElement: HTMLElement): object => {
  const pmEl = pageElement.querySelector('.ProseMirror') as HTMLElement | null
  
  if (!pmEl) {
    return { error: 'ProseMirror element not found' }
  }
  
  const containerInfo = getElementSizeInfo(pageElement)
  const pmInfo = getElementSizeInfo(pmEl)
  
  return {
    container: {
      ...containerInfo,
      description: '页面容器尺寸信息'
    },
    proseMirror: {
      ...pmInfo,
      description: 'ProseMirror编辑器尺寸信息'
    },
    config: {
      maxHeight: PAGE_CONFIG.CONTENT_MAX_HEIGHT,
      a4Height: PAGE_CONFIG.A4_HEIGHT,
      pageMargin: PAGE_CONFIG.PAGE_MARGIN,
      description: '配置的页面尺寸参数'
    },
    analysis: {
      effectiveContentHeight: pmInfo.totalHeight + containerInfo.paddingTop + containerInfo.paddingBottom + 
                             containerInfo.borderTop + containerInfo.borderBottom,
      remainingSpace: PAGE_CONFIG.CONTENT_MAX_HEIGHT - pmInfo.contentHeight,
      isOverflowing: (pmInfo.totalHeight + containerInfo.paddingTop + containerInfo.paddingBottom + 
                     containerInfo.borderTop + containerInfo.borderBottom) > (PAGE_CONFIG.CONTENT_MAX_HEIGHT - 30),
      description: '尺寸分析结果'
    }
  }
}

// 节点数据接口
export interface NodeData {
  id: string
  type: string
  position: number
}

// 从编辑器文档中提取节点数据
export const extractNodeData = (editor: any): NodeData[] => {
  const nodes: NodeData[] = []
  const doc = editor.state.doc
  
  doc.descendants((node: any, pos: number) => {
    if (node.isBlock && node.attrs.id) {
      nodes.push({
        id: node.attrs.id,
        type: node.type.name,
        position: pos
      })
    }
  })
  
  return nodes
}

// 检查是否可以向上合并
export const canMergeUpward = (currentHeight: number, nextPageNodes: NodeData[], nextPageElement?: HTMLElement): { canMerge: boolean, nodesToMerge: number } => {
  // 计算剩余空间（简化计算，避免重复减去容器开销）
  let remainingSpace = PAGE_CONFIG.CONTENT_MAX_HEIGHT - currentHeight
  
  // 预留一点缓冲空间，避免合并后刚好溢出
  const BUFFER_SPACE = 20
  remainingSpace = remainingSpace - BUFFER_SPACE
  
  // 如果没有剩余空间或下一页没有节点，则不能合并
  if (remainingSpace <= 0 || nextPageNodes.length === 0) {
    return { canMerge: false, nodesToMerge: 0 }
  }
  
  let nodesToMerge = 0
  let accumulatedHeight = 0
  
  // 如果传入了真实的页面DOM元素，根据节点ID精确测量
  if (nextPageElement) {
    const proseMirrorEl = nextPageElement.querySelector('.ProseMirror') as HTMLElement
    
    if (proseMirrorEl) {
      try {
        
        
        let cumulativeHeight = 0
        
        // 根据节点ID逐个测量高度
        for (let i = 0; i < nextPageNodes.length; i++) {
          const nodeData = nextPageNodes[i]
          const nodeElement = proseMirrorEl.querySelector(`[id="${nodeData.id}"]`) as HTMLElement
          
          if (nodeElement) {
            // 获取节点的完整尺寸信息（包括margin、padding、border）
            const nodeSizeInfo = getElementSizeInfo(nodeElement)
            const nodeHeight = nodeSizeInfo.totalHeight
            
            cumulativeHeight += nodeHeight
            
            // 检查节点是否能放进剩余空间
            if (cumulativeHeight <= remainingSpace) {
              nodesToMerge = i + 1
              accumulatedHeight = cumulativeHeight
            } else {
              break
            }
          } else {
            // 如果找不到对应元素，使用估算高度（考虑一般的margin和padding）
            const estimatedHeight = 60 + 20 // 基础高度 + 估算的间距
            cumulativeHeight += estimatedHeight
            
            if (cumulativeHeight <= remainingSpace) {
              nodesToMerge = i + 1
              accumulatedHeight = cumulativeHeight
            } else {
              break
            }
          }
        }
        
        
        return { canMerge: nodesToMerge > 0, nodesToMerge }
        
      } catch (error) {
        console.warn('Error measuring with ID-based method:', error)
        // 降级到下面的估算方法
      }
    }
  }
  
  // 降级方案：简单估算
  const avgNodeHeight = 80 // 平均每个节点约60px内容 + 20px间距
  
  for (let i = 0; i < nextPageNodes.length && accumulatedHeight < remainingSpace; i++) {
    accumulatedHeight += avgNodeHeight
    nodesToMerge++
  }
  
  
  return { canMerge: nodesToMerge > 0, nodesToMerge }
}

// 调试函数：跟踪光标位置变化
export const trackCursorDuringMerge = (editor: any, operation: string): object => {
  if (!editor) {
    return { error: 'No editor provided' }
  }
  
  const cursorPos = editor.state.selection.from
  const docSize = editor.state.doc.content.size
  const timestamp = new Date().toLocaleTimeString()
  
  return {
    operation,
    timestamp,
    cursor: {
      position: cursorPos,
      documentSize: docSize,
      relativePosition: `${Math.round((cursorPos / docSize) * 100)}%`
    },
    context: {
      isFocused: editor.isFocused,
      isEditable: editor.isEditable,
      hasContent: docSize > 2
    }
  }
}

// 调试函数：分析合并逻辑
export const debugMergeAnalysis = (currentHeight: number, nextPageNodes: NodeData[], nextPageElement?: HTMLElement): object => {
  const remainingSpace = PAGE_CONFIG.CONTENT_MAX_HEIGHT - currentHeight
  const BUFFER_SPACE = 20
  const effectiveSpace = remainingSpace - BUFFER_SPACE
  
  const result = canMergeUpward(currentHeight, nextPageNodes, nextPageElement)
  
  return {
    input: {
      currentPageHeight: currentHeight,
      nextPageNodeCount: nextPageNodes.length,
      configuredMaxHeight: PAGE_CONFIG.CONTENT_MAX_HEIGHT
    },
    calculations: {
      remainingSpace: remainingSpace,
      bufferSpace: BUFFER_SPACE, 
      effectiveSpace: effectiveSpace,
      canMerge: result.canMerge,
      nodesToMerge: result.nodesToMerge
    },
    logic: {
      reasoning: effectiveSpace <= 0 
        ? `❌ 无剩余空间 (${effectiveSpace}px ≤ 0)`
        : nextPageNodes.length === 0
        ? `❌ 下一页无内容`
        : result.canMerge
        ? `✅ 可合并 ${result.nodesToMerge} 个节点`
        : `⚠️ 下一页首个节点太大，无法合并`,
      
      nextSteps: result.canMerge 
        ? `将下一页前 ${result.nodesToMerge} 个节点移动到当前页`
        : `保持当前分页状态`
    },
    nodeAnalysis: nextPageNodes.slice(0, 3).map((node, index) => ({
      index: index + 1,
      id: node.id.substring(0, 8) + '...',
      type: node.type
    }))
  }
}

// 计算分页分割点
export const calculateSplitPoint = (nodeCount: number): number => {
  let splitPoint = nodeCount - 1 // 默认只移动最后一个节点
  
  // 如果节点很多，可以移动更多节点以确保不再溢出
  if (nodeCount > 10) {
    splitPoint = nodeCount - 2 // 移动最后两个节点
  } else if (nodeCount > 20) {
    splitPoint = nodeCount - 3 // 移动最后三个节点
  }
  
  // 至少保留一个节点在当前页面
  return Math.max(1, splitPoint)
}

// 检查光标是否在文档末尾编辑（保留旧函数作为备用）
export const isCursorAtEnd = (editor: any): boolean => {
  const selection = editor.state.selection
  const docSize = editor.state.doc.content.size
  const cursorPosition = selection.from
  return cursorPosition > docSize * 0.8 // 如果光标在文档后80%的位置
}

// 检查是否在删除且光标在开头
export const isDeletingAtBeginning = (
  currentContentSize: number, 
  previousContentSize: number, 
  cursorPosition: number
): boolean => {
  const isDeleting = currentContentSize < previousContentSize
  const isAtBeginning = cursorPosition <= 2 // 在文档开始位置（考虑到文档结构）
  return isDeleting && isAtBeginning
} 