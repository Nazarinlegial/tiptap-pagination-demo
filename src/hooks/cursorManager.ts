// Cursor position management related utility functions

// Cursor position info
export interface CursorPosition {
  from: number
  to: number
  docSize: number
}

// Get editor cursor position info
export const getCursorPosition = (editor: any): CursorPosition => {
  const selection = editor.state.selection
  const docSize = editor.state.doc.content.size
  
  return {
    from: selection.from,
    to: selection.to,
    docSize
  }
}

// Move cursor to document start
export const moveCursorToStart = (editor: any): void => {
  editor.commands.focus()
  editor.commands.setTextSelection(1)
}

// Move cursor to document end
export const moveCursorToEnd = (editor: any): void => {
  editor.commands.focus()
  const docSize = editor.state.doc.content.size
  editor.commands.setTextSelection(docSize - 1)
}

// Restore cursor to specified position
export const restoreCursorPosition = (editor: any, position: number): void => {
  const docSize = editor.state.doc.content.size
  const safePosition = Math.min(position, docSize - 1)
  
  editor.commands.focus()
  editor.commands.setTextSelection(safePosition)
}

// Check if cursor is in specified position range
export const isCursorInRange = (cursorPosition: CursorPosition, startPercent: number, endPercent: number): boolean => {
  const relativePosition = cursorPosition.from / cursorPosition.docSize
  return relativePosition >= startPercent && relativePosition <= endPercent
}

// Check if cursor is at document start
export const isCursorAtStart = (cursorPosition: CursorPosition): boolean => {
  return cursorPosition.from <= 2
}

// Check if cursor is at document end position
export const isCursorAtEndPosition = (cursorPosition: CursorPosition, threshold: number = 0.8): boolean => {
  return cursorPosition.from > cursorPosition.docSize * threshold
}

// Precisely check if cursor is at end position of last node
export const isCursorAtLastNode = (editor: any): boolean => {
  const { state } = editor
  const { selection, doc } = state
  const { from } = selection
  
  // Get all child nodes of document
  const nodeCount = doc.content.childCount
  if (nodeCount === 0) return false
  
  // Get last node
  const lastNode = doc.content.child(nodeCount - 1)
  if (!lastNode) return false
  
  // Calculate position range of last node
  let nodeStartPos = 1 // Document start position
  for (let i = 0; i < nodeCount - 1; i++) {
    nodeStartPos += doc.content.child(i).nodeSize
  }
  
  const nodeEndPos = nodeStartPos + lastNode.nodeSize
  
  // Check if cursor is in last node
  const isInLastNode = from >= nodeStartPos && from <= nodeEndPos
  
  if (!isInLastNode) return false
  
  // If in last node, check if in latter half of node
  const nodeLength = lastNode.nodeSize
  const cursorPositionInNode = from - nodeStartPos
  const isInLastHalfOfNode = cursorPositionInNode > nodeLength * 0.7 // In last 70% of node
  
  return isInLastHalfOfNode
}

// Check if cursor is at last line (more precise check)
export const isCursorAtLastLine = (editor: any): boolean => {
  try {
    const { state } = editor
    const { selection, doc } = state
    const { from } = selection
    
    // Get node where cursor is located
    const resolvedPos = doc.resolve(from)
    const currentNode = resolvedPos.node()
    
    // If current node is paragraph, check if it's last paragraph
    if (currentNode && currentNode.type.name === 'paragraph') {
      // Get all paragraph nodes
      const paragraphs: any[] = []
      doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'paragraph') {
          paragraphs.push({ node, pos })
        }
      })
      
      if (paragraphs.length === 0) return false
      
      // Check if in last paragraph
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

// Comprehensive judgment: whether cursor is at real editing end (need to jump to next page)
export const shouldJumpToNextPage = (editor: any): boolean => {
  // Satisfy both conditions: at last node AND at last line
  const isAtLastLine = isCursorAtLastLine(editor)
  
  const shouldJump = isAtLastLine
  
  return shouldJump
}