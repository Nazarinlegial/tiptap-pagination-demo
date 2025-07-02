// 光标位置管理相关的工具函数

// 光标位置信息
export interface CursorPosition {
  from: number
  to: number
  docSize: number
}

// 获取编辑器光标位置信息
export const getCursorPosition = (editor: any): CursorPosition => {
  const selection = editor.state.selection
  const docSize = editor.state.doc.content.size
  
  return {
    from: selection.from,
    to: selection.to,
    docSize
  }
}

// 将光标移动到文档开头
export const moveCursorToStart = (editor: any): void => {
  editor.commands.focus()
  editor.commands.setTextSelection(1)
}

// 将光标移动到文档末尾
export const moveCursorToEnd = (editor: any): void => {
  editor.commands.focus()
  const docSize = editor.state.doc.content.size
  editor.commands.setTextSelection(docSize - 1)
}

// 恢复光标到指定位置
export const restoreCursorPosition = (editor: any, position: number): void => {
  const docSize = editor.state.doc.content.size
  const safePosition = Math.min(position, docSize - 1)
  
  editor.commands.focus()
  editor.commands.setTextSelection(safePosition)
}

// 检查光标是否在指定位置范围内
export const isCursorInRange = (cursorPosition: CursorPosition, startPercent: number, endPercent: number): boolean => {
  const relativePosition = cursorPosition.from / cursorPosition.docSize
  return relativePosition >= startPercent && relativePosition <= endPercent
}

// 检查光标是否在文档开头
export const isCursorAtStart = (cursorPosition: CursorPosition): boolean => {
  return cursorPosition.from <= 2
}

// 检查光标是否在文档末尾
export const isCursorAtEndPosition = (cursorPosition: CursorPosition, threshold: number = 0.8): boolean => {
  return cursorPosition.from > cursorPosition.docSize * threshold
}

// 精确检查光标是否在最后一个节点的末尾位置
export const isCursorAtLastNode = (editor: any): boolean => {
  const { state } = editor
  const { selection, doc } = state
  const { from } = selection
  
  // 获取文档的所有子节点
  const nodeCount = doc.content.childCount
  if (nodeCount === 0) return false
  
  // 获取最后一个节点
  const lastNode = doc.content.child(nodeCount - 1)
  if (!lastNode) return false
  
  // 计算最后一个节点的位置范围
  let nodeStartPos = 1 // 文档开始位置
  for (let i = 0; i < nodeCount - 1; i++) {
    nodeStartPos += doc.content.child(i).nodeSize
  }
  
  const nodeEndPos = nodeStartPos + lastNode.nodeSize
  
  // 检查光标是否在最后一个节点内
  const isInLastNode = from >= nodeStartPos && from <= nodeEndPos
  
  if (!isInLastNode) return false
  
  // 如果在最后一个节点内，检查是否在节点的后半部分
  const nodeLength = lastNode.nodeSize
  const cursorPositionInNode = from - nodeStartPos
  const isInLastHalfOfNode = cursorPositionInNode > nodeLength * 0.7 // 在节点的后70%位置
  
  
  return isInLastHalfOfNode
}

// 检查光标是否在最后一行（更精确的检查）
export const isCursorAtLastLine = (editor: any): boolean => {
  try {
    const { state } = editor
    const { selection, doc } = state
    const { from } = selection
    
    // 获取光标所在的节点
    const resolvedPos = doc.resolve(from)
    const currentNode = resolvedPos.node()
    
    // 如果当前节点是段落，检查是否是最后一个段落
    if (currentNode && currentNode.type.name === 'paragraph') {
      // 获取所有段落节点
      const paragraphs: any[] = []
      doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'paragraph') {
          paragraphs.push({ node, pos })
        }
      })
      
      if (paragraphs.length === 0) return false
      
      // 检查是否在最后一个段落中
      const lastParagraph = paragraphs[paragraphs.length - 1]
      const currentParagraphPos = resolvedPos.start() - 1
      
      const isLastParagraph = Math.abs(currentParagraphPos - lastParagraph.pos) < 2
      
      
      return isLastParagraph
    }
    
    return false
  } catch (error) {
    console.warn('Error checking cursor position:', error)
    return false
  }
}

// 综合判断：光标是否在真正的编辑末尾（需要跳转到下一页）
export const shouldJumpToNextPage = (editor: any): boolean => {
  // 同时满足两个条件：在最后一个节点 AND 在最后一行
  //const isAtLastNode = isCursorAtLastNode(editor)
  const isAtLastLine = isCursorAtLastLine(editor)
  
  //const shouldJump = isAtLastNode && isAtLastLine
  const shouldJump = isAtLastLine
  
  
  return shouldJump
} 