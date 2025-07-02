// 防抖和节流工具
// 用于优化频繁的更新操作，提升性能

import { ref, onBeforeUnmount } from 'vue'

// 防抖函数类型
type DebouncedFunction<T extends (...args: any[]) => any> = T & {
  cancel: () => void
  flush: () => void
}

// 创建防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: number | null = null
  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  const debouncedFunction = function (this: any, ...args: Parameters<T>) {
    lastArgs = args
    lastThis = this

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      func.apply(lastThis, lastArgs as Parameters<T>)
      timeoutId = null
    }, delay)
  } as DebouncedFunction<T>

  // 取消防抖
  debouncedFunction.cancel = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
      lastArgs = null
      lastThis = null
    }
  }

  // 立即执行
  debouncedFunction.flush = () => {
    if (timeoutId !== null && lastArgs !== null) {
      window.clearTimeout(timeoutId)
      func.apply(lastThis, lastArgs)
      timeoutId = null
      lastArgs = null
      lastThis = null
    }
  }

  return debouncedFunction
}

// 节流函数类型
type ThrottledFunction<T extends (...args: any[]) => any> = T & {
  cancel: () => void
}

// 创建节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ThrottledFunction<T> {
  let timeoutId: number | null = null
  let lastExecTime = 0

  const throttledFunction = function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now()

    if (currentTime - lastExecTime >= delay) {
      // 立即执行
      func.apply(this, args)
      lastExecTime = currentTime
    } else if (timeoutId === null) {
      // 设置延迟执行
      timeoutId = window.setTimeout(() => {
        func.apply(this, args)
        lastExecTime = Date.now()
        timeoutId = null
      }, delay - (currentTime - lastExecTime))
    }
  } as ThrottledFunction<T>

  throttledFunction.cancel = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return throttledFunction
}

// 组合式 API 防抖工具
export function useDebounce() {
  const debounceTimers = ref<Map<string, number>>(new Map())

  // 创建防抖函数
  const createDebounce = <T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number = 300
  ) => {
    return (...args: Parameters<T>) => {
      // 清除之前的定时器
      const existingTimer = debounceTimers.value.get(key)
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }

      // 设置新的定时器
      const timerId = window.setTimeout(() => {
        func(...args)
        debounceTimers.value.delete(key)
      }, delay)

      debounceTimers.value.set(key, timerId)
    }
  }

  // 立即执行并取消防抖
  const flush = (key: string) => {
    const timerId = debounceTimers.value.get(key)
    if (timerId) {
      window.clearTimeout(timerId)
      debounceTimers.value.delete(key)
    }
  }

  // 取消特定的防抖
  const cancel = (key: string) => {
    const timerId = debounceTimers.value.get(key)
    if (timerId) {
      window.clearTimeout(timerId)
      debounceTimers.value.delete(key)
    }
  }

  // 取消所有防抖
  const cancelAll = () => {
    debounceTimers.value.forEach(timerId => {
      window.clearTimeout(timerId)
    })
    debounceTimers.value.clear()
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    cancelAll()
  })

  return {
    createDebounce,
    flush,
    cancel,
    cancelAll
  }
}

// 专门用于编辑器的防抖工具
export function useEditorDebounce() {
  const { createDebounce, cancel, cancelAll } = useDebounce()

  // 内容更新防抖（用于分页检查）
  const debouncedPageCheck = createDebounce(
    'pageCheck',
    (pageIndex: number, checkFunction: (index: number) => void) => {
      checkFunction(pageIndex)
    },
    150 // 150ms 防抖，确保用户输入流畅
  )

  // 高度计算防抖（用于DOM测量）
  const debouncedHeightCalculation = createDebounce(
    'heightCalculation',
    (element: HTMLElement, callback: (height: number) => void) => {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        const height = element.scrollHeight
        callback(height)
      })
    },
    100 // 100ms 防抖，频繁的高度计算
  )

  // 内容分析防抖（用于复杂的文档分析）
  const debouncedContentAnalysis = createDebounce(
    'contentAnalysis',
    (doc: any, callback: (result: any) => void, workerManager?: any) => {
      // 异步分析内容
      if (workerManager) {
        workerManager.analyzeNodes(doc).then(callback).catch(console.error)
      } else {
        // 降级处理
        callback({ nodes: [], stats: { totalNodes: 0, paragraphs: 0, headings: 0, lists: 0, estimatedHeight: 0 } })
      }
    },
    300 // 300ms 防抖，复杂分析操作
  )

  // 自动保存防抖
  const debouncedAutoSave = createDebounce(
    'autoSave',
    (content: any, saveFunction: (content: any) => void) => {
      saveFunction(content)
    },
    2000 // 2秒防抖，自动保存
  )

  return {
    debouncedPageCheck,
    debouncedHeightCalculation,
    debouncedContentAnalysis,
    debouncedAutoSave,
    cancel,
    cancelAll
  }
}

// 注意：useWorkerManager 需要在使用时单独导入以避免循环依赖 