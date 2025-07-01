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