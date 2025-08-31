// Debounce and throttle utilities
// Used to optimize frequent update operations and improve performance

import { useRef, useCallback, useEffect } from 'react'

// Debounced function type
type DebouncedFunction<T extends (...args: any[]) => any> = T & {
  cancel: () => void
  flush: () => void
}

// Create debounced function
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

  // Cancel debounce
  debouncedFunction.cancel = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
      lastArgs = null
      lastThis = null
    }
  }

  // Execute immediately
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

// Throttled function type
type ThrottledFunction<T extends (...args: any[]) => any> = T & {
  cancel: () => void
}

// Create throttled function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ThrottledFunction<T> {
  let timeoutId: number | null = null
  let lastExecTime = 0

  const throttledFunction = function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now()

    if (currentTime - lastExecTime >= delay) {
      // Execute immediately
      func.apply(this, args)
      lastExecTime = currentTime
    } else if (timeoutId === null) {
      // Set delayed execution
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

// Composable API debounce utility
export function useDebounce() {
  const debounceTimers = useRef<Map<string, number>>(new Map())

  // Create debounced function
  const createDebounce = useCallback(<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number = 300
  ) => {
    return (...args: Parameters<T>) => {
      // Clear previous timer
      const existingTimer = debounceTimers.current.get(key)
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }

      // Set new timer
      const timerId = window.setTimeout(() => {
        func(...args)
        debounceTimers.current.delete(key)
      }, delay)

      debounceTimers.current.set(key, timerId)
    }
  }, [])

  // Execute immediately and cancel debounce
  const flush = useCallback((key: string) => {
    const timerId = debounceTimers.current.get(key)
    if (timerId) {
      window.clearTimeout(timerId)
      debounceTimers.current.delete(key)
    }
  }, [])

  // Cancel specific debounce
  const cancel = useCallback((key: string) => {
    const timerId = debounceTimers.current.get(key)
    if (timerId) {
      window.clearTimeout(timerId)
      debounceTimers.current.delete(key)
    }
  }, [])

  // Cancel all debounces
  const cancelAll = useCallback(() => {
    debounceTimers.current.forEach(timerId => {
      window.clearTimeout(timerId)
    })
    debounceTimers.current.clear()
  }, [])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cancelAll()
    }
  }, [cancelAll])

  return {
    createDebounce,
    flush,
    cancel,
    cancelAll
  }
}

// Debounce utility specifically for editor
export function useEditorDebounce() {
  const { createDebounce, cancel, cancelAll } = useDebounce()

  // Content update debounce (for pagination check)
  const debouncedPageCheck = useCallback(createDebounce(
    'pageCheck',
    (pageIndex: number, checkFunction: (index: number) => void) => {
      checkFunction(pageIndex)
    },
    150 // 150ms debounce, ensure smooth user input
  ), [createDebounce])

  // Height calculation debounce (for DOM measurement)
  const debouncedHeightCalculation = useCallback(createDebounce(
    'heightCalculation',
    (element: HTMLElement, callback: (height: number) => void) => {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const height = element.scrollHeight
        callback(height)
      })
    },
    100 // 100ms debounce, frequent height calculations
  ), [createDebounce])

  // Content analysis debounce (for complex document analysis)
  const debouncedContentAnalysis = useCallback(createDebounce(
    'contentAnalysis',
    (doc: any, callback: (result: any) => void, workerManager?: any) => {
      // Async content analysis
      if (workerManager) {
        workerManager.analyzeNodes(doc).then(callback).catch(console.error)
      } else {
        // Fallback processing
        callback({ nodes: [], stats: { totalNodes: 0, paragraphs: 0, headings: 0, lists: 0, estimatedHeight: 0 } })
      }
    },
    300 // 300ms debounce, complex analysis operations
  ), [createDebounce])

  // Auto save debounce
  const debouncedAutoSave = useCallback(createDebounce(
    'autoSave',
    (content: any, saveFunction: (content: any) => void) => {
      saveFunction(content)
    },
    2000 // 2 second debounce, auto save
  ), [createDebounce])

  return {
    debouncedPageCheck,
    debouncedHeightCalculation,
    debouncedContentAnalysis,
    debouncedAutoSave,
    cancel,
    cancelAll
  }
}

// Note: useWorkerManager needs to be imported separately when used to avoid circular dependencies