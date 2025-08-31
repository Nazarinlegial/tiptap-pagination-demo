// Page calculation related utility functions

export const PAGE_CONFIG = {
  A4_HEIGHT: 1123,
  A4_WIDTH: 794,
  PAGE_MARGIN: 60,
  PAGE_NUMBER_HEIGHT: 40,
  // Actual available content height: A4 total height - top/bottom padding(120px) - page number area(40px) - safety buffer(20px)
  CONTENT_MAX_HEIGHT: 1123 - (60 * 2) - 40 - 20, // 943px -> theoretical 963px, but keep 20px buffer
  // For more precision, can adjust to: 1123 - 120 - 40 - 10 = 953px
  INITIAL_PRELOAD_COUNT: 5,
  EXPAND_THRESHOLD: 4,
  EXPAND_COUNT: 5
}

// Check if page is really empty (stricter judgment)
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

// Calculate element's complete size information
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

// Get element's detailed size information
const getElementSizeInfo = (element: HTMLElement): ElementSizeInfo => {
  const computedStyle = window.getComputedStyle(element)
  
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
  const borderTop = parseFloat(computedStyle.borderTopWidth) || 0
  const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0
  const marginTop = parseFloat(computedStyle.marginTop) || 0
  const marginBottom = parseFloat(computedStyle.marginBottom) || 0
  
  // Content height (excluding padding and border)
  const contentHeight = element.scrollHeight
  
  // Total height (including all spacing)
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

// Check if page overflows
export const checkPageOverflowState = (pageElement: HTMLElement): { hasOverflow: boolean, actualHeight: number } => {
  // Get ProseMirror element in page element
  const pmEl = pageElement.querySelector('.ProseMirror') as HTMLElement | null
  // If ProseMirror element doesn't exist, consider page not overflowing
  if (!pmEl) {
    return { hasOverflow: false, actualHeight: 0 }
  }

  // Directly use ProseMirror element's scrollHeight as content height
  // This is the most accurate content height, excluding duplicate spacing calculations
  const actualContentHeight = pmEl.scrollHeight
  
  // Get overflow threshold (remove excessive buffer space)
  const OVERFLOW_THRESHOLD = PAGE_CONFIG.CONTENT_MAX_HEIGHT
  const BUFFER_SPACE = 10 // Reduce buffer space to avoid premature pagination
  
  // Check overflow: only compare ProseMirror's actual content height with configured max height
  const hasOverflow = actualContentHeight > (OVERFLOW_THRESHOLD - BUFFER_SPACE)
  
  // Debug info
  if (hasOverflow) {
    console.log(`页面溢出检测: 内容高度=${actualContentHeight}px, 阈值=${OVERFLOW_THRESHOLD - BUFFER_SPACE}px`)
  }
  
  return { hasOverflow, actualHeight: actualContentHeight }
}

// Debug function: real-time analysis of pagination trigger reasons
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

// Debug function: analyze A4 page and content area height relationship
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
  
  // Calculate actual height occupied by each part
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
      
      // Detailed height breakdown
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

// Debug function: get detailed page size information (keep original functionality)
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

// Node data interface
export interface NodeData {
  id: string
  type: string
  position: number
}

// Extract node data from editor document
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

// Check if can merge upward
export const canMergeUpward = (currentHeight: number, nextPageNodes: NodeData[], nextPageElement?: HTMLElement): { canMerge: boolean, nodesToMerge: number } => {
  // Calculate remaining space (simplified calculation, avoid duplicate container overhead)
  let remainingSpace = PAGE_CONFIG.CONTENT_MAX_HEIGHT - currentHeight
  
  // Reserve some buffer space to avoid merging and then overflowing
  const BUFFER_SPACE = 20
  remainingSpace = remainingSpace - BUFFER_SPACE
  
  // If no remaining space or next page has no nodes, can't merge
  if (remainingSpace <= 0 || nextPageNodes.length === 0) {
    return { canMerge: false, nodesToMerge: 0 }
  }
  
  let nodesToMerge = 0
  let accumulatedHeight = 0
  
  // If real page DOM element is passed, measure precisely by node ID
  if (nextPageElement) {
    const proseMirrorEl = nextPageElement.querySelector('.ProseMirror') as HTMLElement
    
    if (proseMirrorEl) {
      try {
        let cumulativeHeight = 0
        
        // Measure height by node ID one by one
        for (let i = 0; i < nextPageNodes.length; i++) {
          const nodeData = nextPageNodes[i]
          const nodeElement = proseMirrorEl.querySelector(`[id="${nodeData.id}"]`) as HTMLElement
          
          if (nodeElement) {
            // Get node's complete size info (including margin, padding, border)
            const nodeSizeInfo = getElementSizeInfo(nodeElement)
            const nodeHeight = nodeSizeInfo.totalHeight
            
            cumulativeHeight += nodeHeight
            
            // Check if node can fit in remaining space
            if (cumulativeHeight <= remainingSpace) {
              nodesToMerge = i + 1
              accumulatedHeight = cumulativeHeight
            } else {
              break
            }
          } else {
            // If corresponding element not found, use estimated height (consider general margin and padding)
            const estimatedHeight = 60 + 20 // Base height + estimated spacing
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
        // Fallback to estimation method below
      }
    }
  }
  
  // Fallback: simple estimation
  const avgNodeHeight = 80 // Average ~60px content + 20px spacing per node
  
  for (let i = 0; i < nextPageNodes.length && accumulatedHeight < remainingSpace; i++) {
    accumulatedHeight += avgNodeHeight
    nodesToMerge++
  }
  
  return { canMerge: nodesToMerge > 0, nodesToMerge }
}

// Debug function: track cursor position changes
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

// Debug function: analyze merge logic
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

// Calculate pagination split point
export const calculateSplitPoint = (nodeCount: number): number => {
  let splitPoint = nodeCount - 1 // Default: only move last node
  
  // If many nodes, can move more nodes to ensure no more overflow
  if (nodeCount > 10) {
    splitPoint = nodeCount - 2 // Move last two nodes
  } else if (nodeCount > 20) {
    splitPoint = nodeCount - 3 // Move last three nodes
  }
  
  // Keep at least one node on current page
  return Math.max(1, splitPoint)
}

// Check if cursor is at document end for editing (keep old function as backup)
export const isCursorAtEnd = (editor: any): boolean => {
  const selection = editor.state.selection
  const docSize = editor.state.doc.content.size
  const cursorPosition = selection.from
  return cursorPosition > docSize * 0.8 // If cursor is in last 80% of document
}

// Check if deleting and cursor at beginning
export const isDeletingAtBeginning = (
  currentContentSize: number, 
  previousContentSize: number, 
  cursorPosition: number
): boolean => {
  const isDeleting = currentContentSize < previousContentSize
  const isAtBeginning = cursorPosition <= 2 // At document start (considering document structure)
  return isDeleting && isAtBeginning
}