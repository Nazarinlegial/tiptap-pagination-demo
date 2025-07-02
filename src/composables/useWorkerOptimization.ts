// Worker 优化 Composable
// 在后台异步处理计算密集型任务，不影响主要的编辑器流程

import { ref, onMounted, onBeforeUnmount, readonly } from 'vue'
import { useWorkerManager } from './useWorkerManager'
import { useEditorDebounce } from './useDebounce'

export const useWorkerOptimization = () => {
  const workerManager = useWorkerManager()
  const { debouncedContentAnalysis } = useEditorDebounce()
  
  const isOptimizationEnabled = ref(false)
  const optimizationStats = ref({
    tasksProcessed: 0,
    averageProcessingTime: 0,
    failureRate: 0
  })

  // 初始化优化功能
  const initializeOptimization = async () => {
    try {
      const initialized = await workerManager.initializeWorker()
      isOptimizationEnabled.value = initialized
      
      if (initialized) {
        console.log('🚀 Worker 优化已启用')
      } else {
        console.log('⚠️ Worker 优化不可用，将使用主线程处理')
      }
    } catch (error) {
      console.warn('Worker 优化初始化失败:', error)
      isOptimizationEnabled.value = false
    }
  }

  // 安全地序列化文档用于分析
  const serializeDocForAnalysis = (doc: any): any => {
    try {
      // 如果是 ProseMirror 文档，安全序列化
      if (doc && typeof doc.toJSON === 'function') {
        return doc.toJSON()
      }
      
      // 如果是已经序列化的对象，直接返回
      if (doc && typeof doc === 'object' && doc.type) {
        return doc
      }
      
      // 降级处理
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
  }

  // 后台文档分析
  const backgroundAnalyzeDocument = (doc: any, callback?: (result: any) => void) => {
    if (!isOptimizationEnabled.value) {
      callback?.({ error: 'Worker 不可用' })
      return
    }

    try {
      // 安全序列化文档
      const serializedDoc = serializeDocForAnalysis(doc)
      
      // 使用 Worker 分析
      workerManager.analyzeNodes(serializedDoc).then(result => {
        optimizationStats.value.tasksProcessed++
        callback?.(result)
      }).catch(error => {
        console.warn('后台文档分析失败:', error)
        callback?.({ error: error instanceof Error ? error.message : String(error) })
      })
      
    } catch (error) {
      console.warn('文档分析准备失败:', error)
      callback?.({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  // 预计算分页信息
  const precalculatePagination = async (documents: any[]) => {
    if (!isOptimizationEnabled.value || documents.length === 0) {
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
      
      // 更新统计信息
      optimizationStats.value.averageProcessingTime = 
        (optimizationStats.value.averageProcessingTime + processingTime) / 2
      optimizationStats.value.tasksProcessed++

      console.log(`📊 预计算完成: ${results.length} 个文档, 耗时 ${processingTime.toFixed(2)}ms`)
      return results

    } catch (error) {
      console.warn('预计算分页失败:', error)
      optimizationStats.value.failureRate++
      return []
    }
  }

  // 批量内容处理
  const batchProcessContent = async (operations: Array<{
    type: 'split' | 'merge' | 'analyze'
    data: any
  }>) => {
    if (!isOptimizationEnabled.value) {
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
         optimizationStats.value.failureRate++
       }
    }

    const endTime = performance.now()
    const processingTime = endTime - startTime
    
    optimizationStats.value.averageProcessingTime = 
      (optimizationStats.value.averageProcessingTime + processingTime) / 2
    optimizationStats.value.tasksProcessed += operations.length

    return results
  }

  // 性能监控
  const getPerformanceMetrics = () => {
    return {
      isEnabled: isOptimizationEnabled.value,
      isWorkerReady: workerManager.isWorkerReady.value,
      stats: { ...optimizationStats.value },
      recommendations: generatePerformanceRecommendations()
    }
  }

  // 生成性能建议
  const generatePerformanceRecommendations = () => {
    const recommendations = []

    if (!isOptimizationEnabled.value) {
      recommendations.push('考虑启用 Web Worker 支持以提升性能')
    }

    if (optimizationStats.value.failureRate > 0.1) {
      recommendations.push('Worker 失败率较高，建议检查浏览器兼容性')
    }

    if (optimizationStats.value.averageProcessingTime > 1000) {
      recommendations.push('处理时间较长，考虑优化文档结构或减少批处理大小')
    }

    if (optimizationStats.value.tasksProcessed > 100) {
      recommendations.push('已处理大量任务，性能表现良好')
    }

    return recommendations
  }

  // 自动优化建议
  const suggestOptimizations = (currentDocuments: any[]) => {
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
  }

  // 清理资源
  const cleanup = () => {
    workerManager.cleanup()
    isOptimizationEnabled.value = false
  }

  // 生命周期
  onMounted(() => {
    initializeOptimization()
  })

  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    // 状态
    isOptimizationEnabled: readonly(isOptimizationEnabled),
    optimizationStats: readonly(optimizationStats),
    
    // 方法
    initializeOptimization,
    backgroundAnalyzeDocument,
    precalculatePagination,
    batchProcessContent,
    getPerformanceMetrics,
    suggestOptimizations,
    cleanup
  }
} 