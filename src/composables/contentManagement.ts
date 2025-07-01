// 内容管理相关的工具函数

// 内容分割结果类型
export interface ContentSplitResult {
  firstPageContent: any
  overflowContent: any[]
}

// 将文档内容按指定分割点分割
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

  // 创建当前页保留的内容
  let firstPageContent = { type: 'doc', content: [{ type: 'paragraph' }] }
  if (firstPageNodes.length > 0) {
    firstPageContent = {
      type: 'doc',
      content: firstPageNodes
    }
  }

  return { firstPageContent, overflowContent: overflowNodes }
}

// 合并两个文档内容
export const mergeDocumentContent = (firstNodes: any[], secondNodes: any[]): any => {
  return {
    type: 'doc',
    content: [...firstNodes, ...secondNodes]
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