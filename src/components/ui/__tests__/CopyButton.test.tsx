import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CopyButton } from '../CopyButton'

describe('CopyButton', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a copy button', () => {
    render(<CopyButton text="Hello world" />)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('copies text to clipboard on click', async () => {
    render(<CopyButton text="Hello world" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    })
    expect(writeTextMock).toHaveBeenCalledWith('Hello world')
  })

  it('shows "Copied!" after successful copy', async () => {
    render(<CopyButton text="Hello world" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    })
    expect(screen.getByText(/copied/i)).toBeInTheDocument()
  })

  it('reverts to original text after 2 seconds', async () => {
    render(<CopyButton text="Hello world" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    })
    expect(screen.getByText(/copied/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('shows fallback message when clipboard API fails', async () => {
    vi.useRealTimers()
    writeTextMock.mockRejectedValue(new Error('Not allowed'))
    render(<CopyButton text="Hello world" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/select.*text/i)).toBeInTheDocument()
    })
    vi.useFakeTimers()
  })

  it('has accessible aria-label', () => {
    render(<CopyButton text="content" label="Copy caption" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy caption')
  })
})
