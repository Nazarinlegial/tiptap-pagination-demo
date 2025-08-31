// Web Worker manager
// Provides unified Worker communication interface and fallback solutions

import { useState, useCallback, useRef, useEffect } from 'react'
import type { DocumentWorkerMessage, DocumentWorkerResponse } from '../workers/documentProcessor.worker'

interface WorkerTask {
  id: string
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout?: number
}

export const useWorkerManager = () => {
  const [isWorkerSupported, setIsWorkerSupported] = useState(false)
  const [isWorkerReady, setIsWorkerReady] = useState(false)
  const worker = useRef<Worker | null>(null)
  const pendingTasks = useRef<Map<string, WorkerTask>>(new Map())
  
  // Check Worker support
  const checkWorkerSupport = useCallback((): boolean => {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined'
  }, [])

  // Initialize Worker
  const initializeWorker = useCallback(async (): Promise<boolean> => {
    if (!checkWorkerSupport()) {
      console.warn('Web Worker 不支持，将使用主线程处理')
      setIsWorkerSupported(false)
      return false
    }

    try {
      // Dynamic import Worker
      const workerUrl = new URL('../workers/documentProcessor.worker.ts', import.meta.url)
      worker.current = new Worker(workerUrl, { type: 'module' })
      
      // Set message listener
      worker.current.onmessage = handleWorkerMessage
      worker.current.onerror = handleWorkerError
      
      setIsWorkerSupported(true)
      setIsWorkerReady(true)
      
      console.log('📦 Web Worker 初始化成功')
      return true
      
    } catch (error) {
      console.warn('Web Worker 初始化失败，降级到主线程:', error)
      setIsWorkerSupported(false)
      setIsWorkerReady(false)
      return false
    }
  }, [checkWorkerSupport])

  // Handle Worker messages
  const handleWorkerMessage = useCallback((event: MessageEvent<DocumentWorkerResponse>) => {
    const { id, success, payload, error } = event.data
    const task = pendingTasks.current.get(id)
    
    if (!task) {
      console.warn(`未找到任务 ID: ${id}`)
      return
    }
    
    // Cleanup task
    if (task.timeout) {
      window.clearTimeout(task.timeout)
    }
    pendingTasks.current.delete(id)
    
    // Handle result
    if (success) {
      task.resolve(payload)
    } else {
      task.reject(new Error(error || 'Worker 处理失败'))
    }
  }, [])

  // Handle Worker errors
  const handleWorkerError = useCallback((error: ErrorEvent) => {
    console.error('Web Worker 错误:', error)
    
    // Cleanup all pending tasks
    pendingTasks.current.forEach(task => {
      if (task.timeout) {
        window.clearTimeout(task.timeout)
      }
      task.reject(new Error('Worker 发生错误'))
    })
    pendingTasks.current.clear()
    
    setIsWorkerReady(false)
  }, [])

  // Generate task ID
  const generateTaskId = useCallback((): string => {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Send task to Worker
  const sendTask = useCallback(<T = any>(
    type: DocumentWorkerMessage['type'], 
    payload: any, 
    timeout: number = 10000
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = generateTaskId()
      
      // Create task record
      const task: WorkerTask = {
        id,
        resolve,
        reject
      }
      
      // Set timeout
      task.timeout = window.setTimeout(() => {
        pendingTasks.current.delete(id)
        reject(new Error(`任务超时: ${type}`))
      }, timeout)
      
      pendingTasks.current.set(id, task)
      
      // Send message to Worker
      if (worker.current && isWorkerReady) {
        const message: DocumentWorkerMessage = { id, type, payload }
        worker.current.postMessage(message)
      } else {
        // Worker unavailable, reject immediately
        task.reject(new Error('Worker 不可用'))
      }
    })
  }, [generateTaskId, isWorkerReady])

  // Split document (with fallback)
  const splitDocument = useCallback(async (doc: any, splitPoint: number) => {
    if (!isWorkerSupported || !isWorkerReady) {
      // Fallback to main thread processing
      return fallbackSplitDocument(doc, splitPoint)
    }
    
    try {
      return await sendTask('SPLIT_DOCUMENT', { doc, splitPoint })
    } catch (error) {
      console.warn('Worker 分割文档失败，降级到主线程:', error)
      return fallbackSplitDocument(doc, splitPoint)
    }
  }, [isWorkerSupported, isWorkerReady, sendTask])

  // Merge content (with fallback)
  const mergeContent = useCallback(async (firstNodes: any[], secondNodes: any[]) => {
    if (!isWorkerSupported || !isWorkerReady) {
      return fallbackMergeContent(firstNodes, secondNodes)
    }
    
    try {
      return await sendTask('MERGE_CONTENT', { firstNodes, secondNodes })
    } catch (error) {
      console.warn('Worker 合并内容失败，降级到主线程:', error)
      return fallbackMergeContent(firstNodes, secondNodes)
    }
  }, [isWorkerSupported, isWorkerReady, sendTask])

  // Analyze nodes (with fallback)
  const analyzeNodes = useCallback(async (doc: any) => {
    if (!isWorkerSupported || !isWorkerReady) {
      return fallbackAnalyzeNodes(doc)
    }
    
    try {
      return await sendTask('ANALYZE_NODES', { doc })
    } catch (error) {
      console.warn('Worker 分析节点失败，降级到主线程:', error)
      return fallbackAnalyzeNodes(doc)
    }
  }, [isWorkerSupported, isWorkerReady, sendTask])

  // Calculate split point (with fallback)
  const calculateSplitPoint = useCallback(async (nodeCount: number, targetHeight?: number, nodes?: any[]) => {
    if (!isWorkerSupported || !isWorkerReady) {
      return fallbackCalculateSplitPoint(nodeCount, targetHeight)
    }
    
    try {
      return await sendTask('CALCULATE_SPLIT_POINT', { nodeCount, targetHeight, nodes })
    } catch (error) {
      console.warn('Worker 计算分割点失败，降级到主线程:', error)
      return fallbackCalculateSplitPoint(nodeCount, targetHeight)
    }
  }, [isWorkerSupported, isWorkerReady, sendTask])

  // Fallback: main thread split document
  const fallbackSplitDocument = useCallback((doc: any, splitPoint: number) => {
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
  }, [])

  // Fallback: main thread merge content
  const fallbackMergeContent = useCallback((firstNodes: any[], secondNodes: any[]) => {
    return {
      type: 'doc',
      content: [...firstNodes, ...secondNodes]
    }
  }, [])

  // Fallback: main thread analyze nodes
  const fallbackAnalyzeNodes = useCallback((doc: any) => {
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
  }, [])

  // Fallback: main thread calculate split point
  const fallbackCalculateSplitPoint = useCallback((nodeCount: number, targetHeight: number = 943) => {
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
  }, [])

  // Cleanup resources
  const cleanup = useCallback(() => {
    // Cleanup all pending tasks
    pendingTasks.current.forEach(task => {
      if (task.timeout) {
        window.clearTimeout(task.timeout)
      }
      task.reject(new Error('Worker 正在关闭'))
    })
    pendingTasks.current.clear()
    
    // Terminate Worker
    if (worker.current) {
      worker.current.terminate()
      worker.current = null
    }
    
    setIsWorkerReady(false)
  }, [])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    // State
    isWorkerSupported,
    isWorkerReady,
    
    // Methods
    initializeWorker,
    splitDocument,
    mergeContent,
    analyzeNodes,
    calculateSplitPoint,
    cleanup
  }
}