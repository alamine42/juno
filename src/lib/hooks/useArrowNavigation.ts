import { useCallback, useRef } from 'react'

type NavigationDirection = 'horizontal' | 'vertical' | 'both'

interface UseArrowNavigationOptions {
  /** Navigation direction: horizontal (left/right), vertical (up/down), or both */
  direction?: NavigationDirection
  /** Whether navigation should wrap around at edges */
  loop?: boolean
  /** Selector for focusable items within the container */
  itemSelector?: string
}

/**
 * Hook to enable arrow-key navigation within a container.
 * Used for toolbars, menus, and tab lists to meet WCAG 2.1 keyboard requirements.
 *
 * @example
 * const { containerRef, handleKeyDown } = useArrowNavigation({ direction: 'horizontal' })
 * return (
 *   <div ref={containerRef} role="toolbar" onKeyDown={handleKeyDown}>
 *     <button>Item 1</button>
 *     <button>Item 2</button>
 *   </div>
 * )
 */
export function useArrowNavigation({
  direction = 'horizontal',
  loop = true,
  itemSelector = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
}: UseArrowNavigationOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const getFocusableItems = useCallback(() => {
    if (!containerRef.current) return []
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(itemSelector)
    ).filter((el) => el.offsetParent !== null)
  }, [itemSelector])

  const getCurrentIndex = useCallback(() => {
    const items = getFocusableItems()
    return items.findIndex((item) => item === document.activeElement)
  }, [getFocusableItems])

  const focusItem = useCallback(
    (index: number) => {
      const items = getFocusableItems()
      if (items.length === 0) return

      let targetIndex = index

      if (loop) {
        // Wrap around
        if (targetIndex < 0) targetIndex = items.length - 1
        if (targetIndex >= items.length) targetIndex = 0
      } else {
        // Clamp to bounds
        targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex))
      }

      items[targetIndex]?.focus()
    },
    [getFocusableItems, loop]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentIndex = getCurrentIndex()
      if (currentIndex === -1) return

      const isHorizontal = direction === 'horizontal' || direction === 'both'
      const isVertical = direction === 'vertical' || direction === 'both'

      switch (event.key) {
        case 'ArrowLeft':
          if (isHorizontal) {
            event.preventDefault()
            focusItem(currentIndex - 1)
          }
          break
        case 'ArrowRight':
          if (isHorizontal) {
            event.preventDefault()
            focusItem(currentIndex + 1)
          }
          break
        case 'ArrowUp':
          if (isVertical) {
            event.preventDefault()
            focusItem(currentIndex - 1)
          }
          break
        case 'ArrowDown':
          if (isVertical) {
            event.preventDefault()
            focusItem(currentIndex + 1)
          }
          break
        case 'Home':
          event.preventDefault()
          focusItem(0)
          break
        case 'End':
          event.preventDefault()
          focusItem(getFocusableItems().length - 1)
          break
      }
    },
    [direction, getCurrentIndex, focusItem, getFocusableItems]
  )

  return {
    containerRef,
    handleKeyDown,
  }
}
