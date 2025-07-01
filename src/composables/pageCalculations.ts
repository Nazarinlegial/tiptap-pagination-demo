// 页面计算相关的工具函数

export const PAGE_CONFIG = {
  A4_HEIGHT: 1123,
  A4_WIDTH: 794,
  PAGE_MARGIN: 60,
  PAGE_NUMBER_HEIGHT: 40,
  CONTENT_MAX_HEIGHT: 1123 - (60 * 2) - 40 - 20, // 943px
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

// 检查页面是否溢出
export const checkPageOverflowState = (pageElement: HTMLElement): { hasOverflow: boolean, actualHeight: number } => {
  const pmEl = pageElement.querySelector('.ProseMirror') as HTMLElement | null
  if (!pmEl) {
    return { hasOverflow: false, actualHeight: 0 }
  }

  const actualHeight = pmEl.scrollHeight
  const OVERFLOW_THRESHOLD = PAGE_CONFIG.CONTENT_MAX_HEIGHT + 50
  const hasOverflow = actualHeight > OVERFLOW_THRESHOLD

  return { hasOverflow, actualHeight }
}

// 检查是否可以向上合并
export const canMergeUpward = (currentHeight: number, nextPageNodeCount: number): { canMerge: boolean, nodesToMerge: number } => {
  const remainingSpace = PAGE_CONFIG.CONTENT_MAX_HEIGHT - currentHeight
  const MERGE_THRESHOLD = 200 // 至少有200px空间才考虑合并
  
  if (remainingSpace < MERGE_THRESHOLD || nextPageNodeCount === 0) {
    return { canMerge: false, nodesToMerge: 0 }
  }
  
  // 估算下一页前几个节点的高度（简单估算）
  let nodesToMerge = 0
  let estimatedHeight = 0
  const avgNodeHeight = 60 // 平均每个节点约60px（简单估算）
  
  for (let i = 0; i < nextPageNodeCount && estimatedHeight < remainingSpace - 100; i++) {
    estimatedHeight += avgNodeHeight
    nodesToMerge++
  }
  
  return { canMerge: nodesToMerge > 0, nodesToMerge }
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