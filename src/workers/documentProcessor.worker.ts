// Document processing Web Worker
// Handle document analysis, content splitting, merging and other compute-intensive tasks

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

// Document split result type
interface ContentSplitResult {
  firstPageContent: any
  overflowContent: any[]
}

// Split document content
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

// Merge document content
const mergeDocumentContent = (firstNodes: any[], secondNodes: any[]): any => {
  return {
    type: 'doc',
    content: [...firstNodes, ...secondNodes]
  }
}

// Analyze document nodes
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
      
      // Count different types of nodes
      switch (node.type) {
        case 'paragraph':
          stats.paragraphs++
          stats.estimatedHeight += 40 // Estimated paragraph height
          break
        case 'heading':
          stats.headings++
          stats.estimatedHeight += 60 // Estimated heading height
          break
        case 'bulletList':
        case 'orderedList':
          stats.lists++
          stats.estimatedHeight += 30 * (node.content?.length || 1) // Estimated list height
          break
        default:
          stats.estimatedHeight += 50 // Default height for other nodes
      }
    })
  }

  return { nodes, stats }
}

// Calculate optimal split point
const calculateOptimalSplitPoint = (nodeCount: number, targetHeight: number = 943): number => {
  // Calculate optimal split point based on node count and target height
  let splitPoint = Math.max(1, nodeCount - 1)
  
  // Adjust strategy based on node count
  if (nodeCount > 20) {
    splitPoint = Math.floor(nodeCount * 0.8) // Keep 80% content
  } else if (nodeCount > 10) {
    splitPoint = nodeCount - 2 // Move last 2 nodes
  } else if (nodeCount > 5) {
    splitPoint = nodeCount - 1 // Move last 1 node
  } else {
    splitPoint = Math.max(1, nodeCount - 1) // Keep at least 1 node
  }
  
  return splitPoint
}

// Split nodes by count
const splitNodesByCount = (nodes: any[], splitCount: number) => {
  const firstPart = nodes.slice(0, splitCount)
  const secondPart = nodes.slice(splitCount)
  return { firstPart, secondPart }
}

// Worker message handling
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

    // Send success response
    const response: DocumentWorkerResponse = {
      id,
      type,
      success: true,
      payload: result
    }
    
    self.postMessage(response)
    
  } catch (error) {
    // Send error response
    const response: DocumentWorkerResponse = {
      id,
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    self.postMessage(response)
  }
}