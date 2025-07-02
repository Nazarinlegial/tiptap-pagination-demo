// 内容管理相关的工具函数
// 现在支持 Web Worker 加速处理

import { useWorkerManager } from './useWorkerManager'

// 内容分割结果类型
export interface ContentSplitResult {
  firstPageContent: any
  overflowContent: any[]
}

// Worker 管理器实例（单例模式）
let workerManager: ReturnType<typeof useWorkerManager> | null = null

// 获取或创建 Worker 管理器
const getWorkerManager = () => {
  if (!workerManager) {
    workerManager = useWorkerManager()
  }
  return workerManager
}

// 光标位置分析结果
export interface CursorAnalysisResult {
  cursorPosition: number//光标位置
  splitPosition: number//分割点位置
  cursorInFirstPart: boolean//光标是否在分割点之前
  shouldPreserveCursor: boolean//是否保持光标在原位置
}

// 将文档内容按指定分割点分割（同步版本）
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

// 安全地将 ProseMirror 文档转换为可序列化格式
const serializeProseMirrorDoc = (doc: any): any => {
  try {
    // 方法1：使用 toJSON() 如果可用
    if (doc && typeof doc.toJSON === 'function') {
      return doc.toJSON()
    }
    
    // 方法2：手动提取内容
    if (doc && doc.content) {
      const nodes: any[] = []
      doc.content.forEach((node: any) => {
        if (node && typeof node.toJSON === 'function') {
          nodes.push(node.toJSON())
        } else {
          // 降级：提取基本信息
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
    
    // 方法3：完全降级
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

// 将文档内容按指定分割点分割（异步版本，使用 Web Worker）
export const splitDocumentContentAsync = async (doc: any, splitPoint: number): Promise<ContentSplitResult> => {
  const manager = getWorkerManager()
  
  // 如果 Worker 未初始化，先初始化
  if (!manager.isWorkerReady.value) {
    await manager.initializeWorker()
  }
  
  try {
    // 安全地序列化文档
    const serializedDoc = serializeProseMirrorDoc(doc)
    
    // 使用 Worker 处理分割
    const result = await manager.splitDocument(serializedDoc, splitPoint)
    return result
  } catch (error) {
    console.warn('Worker 分割失败，降级到同步处理:', error)
    return splitDocumentContent(doc, splitPoint)
  }
}

// 分析光标位置相对于分割点的关系
export const analyzeCursorPosition = (editor: any, splitPoint: number): CursorAnalysisResult => {
  const { state } = editor
  const { selection, doc } = state
  const cursorPos = selection.from
  
  // 计算分割点在文档中的实际位置
  let splitPosition = 1 // 文档开始位置
  for (let i = 0; i < splitPoint && i < doc.content.childCount; i++) {
    if (i === splitPoint - 1) {
      // 分割点在这个节点的末尾
      splitPosition += doc.content.child(i).nodeSize
      break
    } else {
      splitPosition += doc.content.child(i).nodeSize
    }
  }
  
  const cursorInFirstPart = cursorPos <= splitPosition
  
  // 判断是否应该保持光标在原位置
  // 如果光标在分割点之前，肯定要保持
  // 如果光标在分割点之后，需要根据是否在"最后编辑区域"判断
  const shouldPreserveCursor = cursorInFirstPart
  
  
  return {
    cursorPosition: cursorPos,
    splitPosition,
    cursorInFirstPart,
    shouldPreserveCursor
  }
}

// 合并两个文档内容（同步版本）
export const mergeDocumentContent = (firstNodes: any[], secondNodes: any[]): any => {
  return {
    type: 'doc',
    content: [...firstNodes, ...secondNodes]
  }
}

// 合并两个文档内容（异步版本，使用 Web Worker）
export const mergeDocumentContentAsync = async (firstNodes: any[], secondNodes: any[]): Promise<any> => {
  const manager = getWorkerManager()
  
  // 如果 Worker 未初始化，先初始化
  if (!manager.isWorkerReady.value) {
    await manager.initializeWorker()
  }
  
  try {
    // 使用 Worker 处理合并
    const result = await manager.mergeContent(firstNodes, secondNodes)
    return result
  } catch (error) {
    console.warn('Worker 合并失败，降级到同步处理:', error)
    return mergeDocumentContent(firstNodes, secondNodes)
  }
}

// 将文档转换为节点数组
export const documentToNodes = (doc: any): any[] => {
  const nodes: any[] = []
  doc.content.forEach((node: any) => {
    nodes.push(node.toJSON())
  })
  return nodes
}

// 按数量分割节点数组
export const splitNodesByCount = (nodes: any[], splitCount: number): { firstPart: any[], secondPart: any[] } => {
  const firstPart = nodes.slice(0, splitCount)
  const secondPart = nodes.slice(splitCount)
  return { firstPart, secondPart }
}

// 创建空文档
export const createEmptyDocument = (): any => {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

// 检查文档是否有实际内容
export const hasActualContent = (doc: any): boolean => {
  if (!doc || !doc.content) return false
  
  const textContent = doc.content
    .map((node: any) => node.content?.map((child: any) => child.text || '').join('') || '')
    .join('')
    .trim()
  
  return textContent.length > 0
} 