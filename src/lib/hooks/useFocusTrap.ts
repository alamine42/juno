import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook to trap focus within a container element.
 * Used for modals and dialogs to meet WCAG 2.1 Level A requirements.
 *
 * @param isActive - Whether the focus trap is active
 * @param restoreFocus - Whether to restore focus to the previously focused element when deactivated
 */
export function useFocusTrap(isActive: boolean, restoreFocus: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => el.offsetParent !== null) // Filter out hidden elements
  }, [])

  // Handle Tab key to trap focus
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      // Shift+Tab on first element -> go to last
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
      // Tab on last element -> go to first
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    },
    [isActive, getFocusableElements]
  )

  useEffect(() => {
    if (isActive) {
      // Store the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus the first focusable element in the container
      const focusableElements = getFocusableElements()
      if (focusableElements.length > 0) {
        // Small delay to ensure the modal is rendered
        requestAnimationFrame(() => {
          focusableElements[0].focus()
        })
      }

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      // Restore focus when deactivating
      if (isActive && restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive, restoreFocus, getFocusableElements, handleKeyDown])

  return containerRef
}
