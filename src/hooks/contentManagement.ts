// Content management related utility functions
// Now supports Web Worker accelerated processing

import { useWorkerManager } from './useWorkerManager'

// Content split result type
export interface ContentSplitResult {
  firstPageContent: any
  overflowContent: any[]
}

// Worker manager instance (singleton pattern)
let workerManager: ReturnType<typeof useWorkerManager> | null = null

// Get or create Worker manager
const getWorkerManager = () => {
  if (!workerManager) {
    workerManager = useWorkerManager()
  }
  return workerManager
}

// Cursor position analysis result
export interface CursorAnalysisResult {
  cursorPosition: number // Cursor position
  splitPosition: number // Split point position
  cursorInFirstPart: boolean // Whether cursor is before split point
  shouldPreserveCursor: boolean // Whether to keep cursor at original position
}

// Split document content by specified split point (sync version)
export const splitDocumentContent = (doc: any, splitPoint: number): ContentSplitResult => {
  const firstPageNodes: any[] = []
  const overflowNodes: any[] = []

  doc.content.forEach((node: any, offset: number, index: number) => {
    if (index < splitPoint) {
      firstPageNodes.push(node.toJSON())
    } else {
      overflowNodes.push(node.toJSON())
    }
  })

  let firstPageContent = { type: 'doc', content: [{ type: 'paragraph' }] }
  if (firstPageNodes.length > 0) {
    firstPageContent = {
      type: 'doc',
      content: firstPageNodes
    }
  }

  return { firstPageContent, overflowContent: overflowNodes }
}

// Safely convert ProseMirror document to serializable format
const serializeProseMirrorDoc = (doc: any): any => {
  try {
    // Method 1: Use toJSON() if available
    if (doc && typeof doc.toJSON === 'function') {
      return doc.toJSON()
    }
    
    // Method 2: Manually extract content
    if (doc && doc.content) {
      const nodes: any[] = []
      doc.content.forEach((node: any) => {
        if (node && typeof node.toJSON === 'function') {
          nodes.push(node.toJSON())
        } else {
          // Fallback: extract basic info
          nodes.push({
            type: node.type?.name || 'paragraph',
            content: node.textContent || '',
            attrs: node.attrs || {}
          })
        }
      })
      
      return {
        type: 'doc',
        content: nodes
      }
    }
    
    // Method 3: Complete fallback
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }]
    }
  } catch (error) {
    console.warn('文档序列化失败:', error)
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }]
    }
  }
}

// Split document content by specified split point (async version, using Web Worker)
export const splitDocumentContentAsync = async (doc: any, splitPoint: number): Promise<ContentSplitResult> => {
  const manager = getWorkerManager()
  
  // If Worker not initialized, initialize first
  if (!manager.isWorkerReady.value) {
    await manager.initializeWorker()
  }
  
  try {
    // Safely serialize document
    const serializedDoc = serializeProseMirrorDoc(doc)
    
    // Use Worker to process split
    const result = await manager.splitDocument(serializedDoc, splitPoint)
    return result
  } catch (error) {
    console.warn('Worker 分割失败，降级到同步处理:', error)
    return splitDocumentContent(doc, splitPoint)
  }
}

// Analyze cursor position relative to split point
export const analyzeCursorPosition = (editor: any, splitPoint: number): CursorAnalysisResult => {
  const { state } = editor
  const { selection, doc } = state
  const cursorPos = selection.from
  
  // Calculate actual position of split point in document
  let splitPosition = 1 // Document start position
  for (let i = 0; i < splitPoint && i < doc.content.childCount; i++) {
    if (i === splitPoint - 1) {
      // Split point at end of this node
      splitPosition += doc.content.child(i).nodeSize
      break
    } else {
      splitPosition += doc.content.child(i).nodeSize
    }
  }
  
  const cursorInFirstPart = cursorPos <= splitPosition
  
  // Determine whether to keep cursor at original position
  // If cursor before split point, definitely keep
  // If cursor after split point, need to judge based on whether in "last editing area"
  const shouldPreserveCursor = cursorInFirstPart
  
  return {
    cursorPosition: cursorPos,
    splitPosition,
    cursorInFirstPart,
    shouldPreserveCursor
  }
}

// Merge two document contents (sync version)
export const mergeDocumentContent = (firstNodes: any[], secondNodes: any[]): any => {
  return {
    type: 'doc',
    content: [...firstNodes, ...secondNodes]
  }
}

// Merge two document contents (async version, using Web Worker)
export const mergeDocumentContentAsync = async (firstNodes: any[], secondNodes: any[]): Promise<any> => {
  const manager = getWorkerManager()
  
  // If Worker not initialized, initialize first
  if (!manager.isWorkerReady.value) {
    await manager.initializeWorker()
  }
  
  try {
    // Use Worker to process merge
    const result = await manager.mergeContent(firstNodes, secondNodes)
    return result
  } catch (error) {
    console.warn('Worker 合并失败，降级到同步处理:', error)
    return mergeDocumentContent(firstNodes, secondNodes)
  }
}

// Convert document to node array
export const documentToNodes = (doc: any): any[] => {
  const nodes: any[] = []
  doc.content.forEach((node: any) => {
    nodes.push(node.toJSON())
  })
  return nodes
}

// Split node array by count
export const splitNodesByCount = (nodes: any[], splitCount: number): { firstPart: any[], secondPart: any[] } => {
  const firstPart = nodes.slice(0, splitCount)
  const secondPart = nodes.slice(splitCount)
  return { firstPart, secondPart }
}

// Create empty document
export const createEmptyDocument = (): any => {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

// Check if document has actual content
export const hasActualContent = (doc: any): boolean => {
  if (!doc || !doc.content) return false
  
  const textContent = doc.content
    .map((node: any) => node.content?.map((child: any) => child.text || '').join('') || '')
    .join('')
    .trim()
  
  return textContent.length > 0
}