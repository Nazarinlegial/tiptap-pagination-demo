// Web Worker 管理器
// 提供统一的 Worker 通信接口和降级方案

import { ref, onBeforeUnmount, readonly } from 'vue'
import type { DocumentWorkerMessage, DocumentWorkerResponse } from '../workers/documentProcessor.worker'

interface WorkerTask {
  id: string
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout?: number
}

export const useWorkerManager = () => {
  const worker = ref<Worker | null>(null)
  const isWorkerSupported = ref(false)
  const pendingTasks = ref<Map<string, WorkerTask>>(new Map())
  const isWorkerReady = ref(false)
  
  // 检查 Worker 支持情况
  const checkWorkerSupport = (): boolean => {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined'
  }

  // 初始化 Worker
  const initializeWorker = async (): Promise<boolean> => {
    if (!checkWorkerSupport()) {
      console.warn('Web Worker 不支持，将使用主线程处理')
      isWorkerSupported.value = false
      return false
    }

    try {
      // 动态导入 Worker
      const workerUrl = new URL('../workers/documentProcessor.worker.ts', import.meta.url)
      worker.value = new Worker(workerUrl, { type: 'module' })
      
      // 设置消息监听
      worker.value.onmessage = handleWorkerMessage
      worker.value.onerror = handleWorkerError
      
      isWorkerSupported.value = true
      isWorkerReady.value = true
      
      console.log('📦 Web Worker 初始化成功')
      return true
      
    } catch (error) {
      console.warn('Web Worker 初始化失败，降级到主线程:', error)
      isWorkerSupported.value = false
      isWorkerReady.value = false
      return false
    }
  }

  // 处理 Worker 消息
  const handleWorkerMessage = (event: MessageEvent<DocumentWorkerResponse>) => {
    const { id, success, payload, error } = event.data
    const task = pendingTasks.value.get(id)
    
    if (!task) {
      console.warn(`未找到任务 ID: ${id}`)
      return
    }
    
    // 清理任务
    if (task.timeout) {
      window.clearTimeout(task.timeout)
    }
    pendingTasks.value.delete(id)
    
    // 处理结果
    if (success) {
      task.resolve(payload)
    } else {
      task.reject(new Error(error || 'Worker 处理失败'))
    }
  }

  // 处理 Worker 错误
  const handleWorkerError = (error: ErrorEvent) => {
    console.error('Web Worker 错误:', error)
    
    // 清理所有待处理的任务
    pendingTasks.value.forEach(task => {
      if (task.timeout) {
        window.clearTimeout(task.timeout)
      }
      task.reject(new Error('Worker 发生错误'))
    })
    pendingTasks.value.clear()
    
    isWorkerReady.value = false
  }

  // 生成任务 ID
  const generateTaskId = (): string => {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // 向 Worker 发送任务
  const sendTask = <T = any>(
    type: DocumentWorkerMessage['type'], 
    payload: any, 
    timeout: number = 10000
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = generateTaskId()
      
      // 创建任务记录
      const task: WorkerTask = {
        id,
        resolve,
        reject
      }
      
      // 设置超时
      task.timeout = window.setTimeout(() => {
        pendingTasks.value.delete(id)
        reject(new Error(`任务超时: ${type}`))
      }, timeout)
      
      pendingTasks.value.set(id, task)
      
      // 发送消息到 Worker
      if (worker.value && isWorkerReady.value) {
        const message: DocumentWorkerMessage = { id, type, payload }
        worker.value.postMessage(message)
      } else {
        // Worker 不可用，立即拒绝
        task.reject(new Error('Worker 不可用'))
      }
    })
  }

  // 分割文档（带降级）
  const splitDocument = async (doc: any, splitPoint: number) => {
    if (!isWorkerSupported.value || !isWorkerReady.value) {
      // 降级到主线程处理
      return fallbackSplitDocument(doc, splitPoint)
    }
    
    try {
      return await sendTask('SPLIT_DOCUMENT', { doc, splitPoint })
    } catch (error) {
      console.warn('Worker 分割文档失败，降级到主线程:', error)
      return fallbackSplitDocument(doc, splitPoint)
    }
  }

  // 合并内容（带降级）
  const mergeContent = async (firstNodes: any[], secondNodes: any[]) => {
    if (!isWorkerSupported.value || !isWorkerReady.value) {
      return fallbackMergeContent(firstNodes, secondNodes)
    }
    
    try {
      return await sendTask('MERGE_CONTENT', { firstNodes, secondNodes })
    } catch (error) {
      console.warn('Worker 合并内容失败，降级到主线程:', error)
      return fallbackMergeContent(firstNodes, secondNodes)
    }
  }

  // 分析节点（带降级）
  const analyzeNodes = async (doc: any) => {
    if (!isWorkerSupported.value || !isWorkerReady.value) {
      return fallbackAnalyzeNodes(doc)
    }
    
    try {
      return await sendTask('ANALYZE_NODES', { doc })
    } catch (error) {
      console.warn('Worker 分析节点失败，降级到主线程:', error)
      return fallbackAnalyzeNodes(doc)
    }
  }

  // 计算分割点（带降级）
  const calculateSplitPoint = async (nodeCount: number, targetHeight?: number, nodes?: any[]) => {
    if (!isWorkerSupported.value || !isWorkerReady.value) {
      return fallbackCalculateSplitPoint(nodeCount, targetHeight)
    }
    
    try {
      return await sendTask('CALCULATE_SPLIT_POINT', { nodeCount, targetHeight, nodes })
    } catch (error) {
      console.warn('Worker 计算分割点失败，降级到主线程:', error)
      return fallbackCalculateSplitPoint(nodeCount, targetHeight)
    }
  }

  // 降级方案：主线程分割文档
  const fallbackSplitDocument = (doc: any, splitPoint: number) => {
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

  // 降级方案：主线程合并内容
  const fallbackMergeContent = (firstNodes: any[], secondNodes: any[]) => {
    return {
      type: 'doc',
      content: [...firstNodes, ...secondNodes]
    }
  }

  // 降级方案：主线程分析节点
  const fallbackAnalyzeNodes = (doc: any) => {
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
        
        switch (node.type) {
          case 'paragraph':
            stats.paragraphs++
            stats.estimatedHeight += 40
            break
          case 'heading':
            stats.headings++
            stats.estimatedHeight += 60
            break
          case 'bulletList':
          case 'orderedList':
            stats.lists++
            stats.estimatedHeight += 30 * (node.content?.length || 1)
            break
          default:
            stats.estimatedHeight += 50
        }
      })
    }

    return { nodes, stats }
  }

  // 降级方案：主线程计算分割点
  const fallbackCalculateSplitPoint = (nodeCount: number, targetHeight: number = 943) => {
    let splitPoint = Math.max(1, nodeCount - 1)
    
    if (nodeCount > 20) {
      splitPoint = Math.floor(nodeCount * 0.8)
    } else if (nodeCount > 10) {
      splitPoint = nodeCount - 2
    } else if (nodeCount > 5) {
      splitPoint = nodeCount - 1
    } else {
      splitPoint = Math.max(1, nodeCount - 1)
    }
    
    return { splitPoint }
  }

  // 清理资源
  const cleanup = () => {
    // 清理所有待处理的任务
    pendingTasks.value.forEach(task => {
      if (task.timeout) {
        window.clearTimeout(task.timeout)
      }
      task.reject(new Error('Worker 正在关闭'))
    })
    pendingTasks.value.clear()
    
    // 终止 Worker
    if (worker.value) {
      worker.value.terminate()
      worker.value = null
    }
    
    isWorkerReady.value = false
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    // 状态
    isWorkerSupported: readonly(isWorkerSupported),
    isWorkerReady: readonly(isWorkerReady),
    
    // 方法
    initializeWorker,
    splitDocument,
    mergeContent,
    analyzeNodes,
    calculateSplitPoint,
    cleanup
  }
} 