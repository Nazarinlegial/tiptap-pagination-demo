// 文档处理 Web Worker
// 处理文档分析、内容分割、合并等计算密集型任务

export interface DocumentWorkerMessage {
  id: string
  type: 'SPLIT_DOCUMENT' | 'MERGE_CONTENT' | 'ANALYZE_NODES' | 'CALCULATE_SPLIT_POINT'
  payload: any
}

export interface DocumentWorkerResponse {
  id: string
  type: string
  success: boolean
  payload?: any
  error?: string
}

// 文档分割结果类型
interface ContentSplitResult {
  firstPageContent: any
  overflowContent: any[]
}

// 分割文档内容
const splitDocumentContent = (doc: any, splitPoint: number): ContentSplitResult => {
  const firstPageNodes: any[] = []
  const overflowNodes: any[] = []

  if (doc.content && Array.isArray(doc.content)) {
    doc.content.forEach((node: any, index: number) => {
      if (index < splitPoint) {
        firstPageNodes.push(node)
      } else {
        overflowNodes.push(node)
      }
    })
  }

  let firstPageContent = { type: 'doc', content: [{ type: 'paragraph' }] }
  if (firstPageNodes.length > 0) {
    firstPageContent = {
      type: 'doc',
      content: firstPageNodes
    }
  }

  return { firstPageContent, overflowContent: overflowNodes }
}

// 合并文档内容
const mergeDocumentContent = (firstNodes: any[], secondNodes: any[]): any => {
  return {
    type: 'doc',
    content: [...firstNodes, ...secondNodes]
  }
}

// 分析文档节点
const analyzeDocumentNodes = (doc: any) => {
  const nodes: any[] = []
  const stats = {
    totalNodes: 0,
    paragraphs: 0,
    headings: 0,
    lists: 0,
    estimatedHeight: 0
  }

  if (doc.content && Array.isArray(doc.content)) {
    doc.content.forEach((node: any, index: number) => {
      nodes.push({
        index,
        type: node.type,
        content: node.content || [],
        attrs: node.attrs || {}
      })

      stats.totalNodes++
      
      // 统计不同类型的节点
      switch (node.type) {
        case 'paragraph':
          stats.paragraphs++
          stats.estimatedHeight += 40 // 预估段落高度
          break
        case 'heading':
          stats.headings++
          stats.estimatedHeight += 60 // 预估标题高度
          break
        case 'bulletList':
        case 'orderedList':
          stats.lists++
          stats.estimatedHeight += 30 * (node.content?.length || 1) // 预估列表高度
          break
        default:
          stats.estimatedHeight += 50 // 其他节点默认高度
      }
    })
  }

  return { nodes, stats }
}

// 计算最优分割点
const calculateOptimalSplitPoint = (nodeCount: number, targetHeight: number = 943): number => {
  // 基于节点数量和目标高度计算最优分割点
  let splitPoint = Math.max(1, nodeCount - 1)
  
  // 根据节点数量调整策略
  if (nodeCount > 20) {
    splitPoint = Math.floor(nodeCount * 0.8) // 保留80%内容
  } else if (nodeCount > 10) {
    splitPoint = nodeCount - 2 // 移动最后2个节点
  } else if (nodeCount > 5) {
    splitPoint = nodeCount - 1 // 移动最后1个节点
  } else {
    splitPoint = Math.max(1, nodeCount - 1) // 至少保留1个节点
  }
  
  return splitPoint
}

// 按数量分割节点
const splitNodesByCount = (nodes: any[], splitCount: number) => {
  const firstPart = nodes.slice(0, splitCount)
  const secondPart = nodes.slice(splitCount)
  return { firstPart, secondPart }
}

// Worker 消息处理
self.onmessage = (event: MessageEvent<DocumentWorkerMessage>) => {
  const { id, type, payload } = event.data
  console.log('Worker 收到消息:', { id, type, payload })
  try {
    let result: any = null

    switch (type) {
      case 'SPLIT_DOCUMENT':
        result = splitDocumentContent(payload.doc, payload.splitPoint)
        break
        
      case 'MERGE_CONTENT':
        result = mergeDocumentContent(payload.firstNodes, payload.secondNodes)
        break
        
      case 'ANALYZE_NODES':
        result = analyzeDocumentNodes(payload.doc)
        break
        
      case 'CALCULATE_SPLIT_POINT':
        result = {
          splitPoint: calculateOptimalSplitPoint(payload.nodeCount, payload.targetHeight),
          splitNodes: payload.nodes ? splitNodesByCount(payload.nodes, calculateOptimalSplitPoint(payload.nodeCount, payload.targetHeight)) : null
        }
        break
        
      default:
        throw new Error(`Unknown message type: ${type}`)
    }

    // 发送成功响应
    const response: DocumentWorkerResponse = {
      id,
      type,
      success: true,
      payload: result
    }
    
    self.postMessage(response)
    
  } catch (error) {
    // 发送错误响应
    const response: DocumentWorkerResponse = {
      id,
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    self.postMessage(response)
  }
} 