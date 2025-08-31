// Worker optimization hook
// Process compute-intensive tasks asynchronously in background without affecting main editor flow

import { useState, useEffect, useCallback } from 'react'
import { useWorkerManager } from './useWorkerManager'
import { useEditorDebounce } from './useDebounce'

export const useWorkerOptimization = () => {
  const workerManager = useWorkerManager()
  const { debouncedContentAnalysis } = useEditorDebounce()
  
  const [isOptimizationEnabled, setIsOptimizationEnabled] = useState(false)
  const [optimizationStats, setOptimizationStats] = useState({
    tasksProcessed: 0,
    averageProcessingTime: 0,
    failureRate: 0
  })

  // Initialize optimization features
  const initializeOptimization = useCallback(async () => {
    try {
      const initialized = await workerManager.initializeWorker()
      setIsOptimizationEnabled(initialized)
      
      if (initialized) {
        console.log('🚀 Worker 优化已启用')
      } else {
        console.log('⚠️ Worker 优化不可用，将使用主线程处理')
      }
    } catch (error) {
      console.warn('Worker 优化初始化失败:', error)
      setIsOptimizationEnabled(false)
    }
  }, [workerManager])

  // Safely serialize document for analysis
  const serializeDocForAnalysis = useCallback((doc: any): any => {
    try {
      // If ProseMirror document, safely serialize
      if (doc && typeof doc.toJSON === 'function') {
        return doc.toJSON()
      }
      
      // If already serialized object, return directly
      if (doc && typeof doc === 'object' && doc.type) {
        return doc
      }
      
      // Fallback processing
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }]
      }
    } catch (error) {
      console.warn('文档分析序列化失败:', error)
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }]
      }
    }
  }, [])

  // Background document analysis
  const backgroundAnalyzeDocument = useCallback((doc: any, callback?: (result: any) => void) => {
    if (!isOptimizationEnabled) {
      callback?.({ error: 'Worker 不可用' })
      return
    }

    try {
      // Safely serialize document
      const serializedDoc = serializeDocForAnalysis(doc)
      
      // Use Worker for analysis
      workerManager.analyzeNodes(serializedDoc).then(result => {
        setOptimizationStats(prev => ({
          ...prev,
          tasksProcessed: prev.tasksProcessed + 1
        }))
        callback?.(result)
      }).catch(error => {
        console.warn('后台文档分析失败:', error)
        callback?.({ error: error instanceof Error ? error.message : String(error) })
      })
      
    } catch (error) {
      console.warn('文档分析准备失败:', error)
      callback?.({ error: error instanceof Error ? error.message : String(error) })
    }
  }, [isOptimizationEnabled, workerManager, serializeDocForAnalysis])

  // Pre-calculate pagination info
  const precalculatePagination = useCallback(async (documents: any[]) => {
    if (!isOptimizationEnabled || documents.length === 0) {
      return []
    }

    const startTime = performance.now()
    const results = []

    try {
      for (const doc of documents) {
        if (doc.content) {
          const nodeCount = doc.content.length || 0
          const result = await workerManager.calculateSplitPoint(nodeCount, 943, doc.content)
          results.push({
            docId: doc.id || `doc-${results.length}`,
            recommendedSplitPoint: result.splitPoint,
            nodeCount
          })
        }
      }

      const endTime = performance.now()
      const processingTime = endTime - startTime
      
      // Update statistics
      setOptimizationStats(prev => ({
        ...prev,
        averageProcessingTime: (prev.averageProcessingTime + processingTime) / 2,
        tasksProcessed: prev.tasksProcessed + 1
      }))

      console.log(`📊 预计算完成: ${results.length} 个文档, 耗时 ${processingTime.toFixed(2)}ms`)
      return results

    } catch (error) {
      console.warn('预计算分页失败:', error)
      setOptimizationStats(prev => ({
        ...prev,
        failureRate: prev.failureRate + 1
      }))
      return []
    }
  }, [isOptimizationEnabled, workerManager])

  // Batch content processing
  const batchProcessContent = useCallback(async (operations: Array<{
    type: 'split' | 'merge' | 'analyze'
    data: any
  }>) => {
    if (!isOptimizationEnabled) {
      return []
    }

    const startTime = performance.now()
    const results = []

    for (const operation of operations) {
      try {
        let result = null

        switch (operation.type) {
          case 'split':
            result = await workerManager.splitDocument(operation.data.doc, operation.data.splitPoint)
            break
          case 'merge':
            result = await workerManager.mergeContent(operation.data.firstNodes, operation.data.secondNodes)
            break
          case 'analyze':
            result = await workerManager.analyzeNodes(operation.data.doc)
            break
        }

        results.push({ success: true, result, operation: operation.type })

      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : String(error), operation: operation.type })
        setOptimizationStats(prev => ({
          ...prev,
          failureRate: prev.failureRate + 1
        }))
      }
    }

    const endTime = performance.now()
    const processingTime = endTime - startTime
    
    setOptimizationStats(prev => ({
      ...prev,
      averageProcessingTime: (prev.averageProcessingTime + processingTime) / 2,
      tasksProcessed: prev.tasksProcessed + operations.length
    }))

    return results
  }, [isOptimizationEnabled, workerManager])

  // Performance monitoring
  const getPerformanceMetrics = useCallback(() => {
    return {
      isEnabled: isOptimizationEnabled,
      isWorkerReady: workerManager.isWorkerReady,
      stats: { ...optimizationStats },
      recommendations: generatePerformanceRecommendations()
    }
  }, [isOptimizationEnabled, workerManager.isWorkerReady, optimizationStats])

  // Generate performance recommendations
  const generatePerformanceRecommendations = useCallback(() => {
    const recommendations = []

    if (!isOptimizationEnabled) {
      recommendations.push('考虑启用 Web Worker 支持以提升性能')
    }

    if (optimizationStats.failureRate > 0.1) {
      recommendations.push('Worker 失败率较高，建议检查浏览器兼容性')
    }

    if (optimizationStats.averageProcessingTime > 1000) {
      recommendations.push('处理时间较长，考虑优化文档结构或减少批处理大小')
    }

    if (optimizationStats.tasksProcessed > 100) {
      recommendations.push('已处理大量任务，性能表现良好')
    }

    return recommendations
  }, [isOptimizationEnabled, optimizationStats])

  // Auto optimization suggestions
  const suggestOptimizations = useCallback((currentDocuments: any[]) => {
    const suggestions = []

    if (currentDocuments.length > 5) {
      suggestions.push({
        type: 'batch_processing',
        description: '建议使用批量处理来优化多文档操作',
        action: () => precalculatePagination(currentDocuments)
      })
    }

    if (currentDocuments.some(doc => doc.content?.length > 20)) {
      suggestions.push({
        type: 'background_analysis',
        description: '检测到大型文档，建议使用后台分析',
        action: () => currentDocuments.forEach(doc => backgroundAnalyzeDocument(doc))
      })
    }

    return suggestions
  }, [precalculatePagination, backgroundAnalyzeDocument])

  // Cleanup resources
  const cleanup = useCallback(() => {
    workerManager.cleanup()
    setIsOptimizationEnabled(false)
  }, [workerManager])

  // Lifecycle
  useEffect(() => {
    initializeOptimization()
    return () => {
      cleanup()
    }
  }, [initializeOptimization, cleanup])

  return {
    // State
    isOptimizationEnabled,
    optimizationStats,
    
    // Methods
    initializeOptimization,
    backgroundAnalyzeDocument,
    precalculatePagination,
    batchProcessContent,
    getPerformanceMetrics,
    suggestOptimizations,
    cleanup
  }
}