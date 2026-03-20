import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders an SVG element', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument()
  })

  it('renders small size', () => {
    render(<LoadingSpinner size="sm" />)
    const svg = screen.getByRole('status').querySelector('svg')
    expect(svg?.classList.toString()).toContain('w-4')
  })

  it('renders medium size by default', () => {
    render(<LoadingSpinner />)
    const svg = screen.getByRole('status').querySelector('svg')
    expect(svg?.classList.toString()).toContain('w-6')
  })

  it('renders large size', () => {
    render(<LoadingSpinner size="lg" />)
    const svg = screen.getByRole('status').querySelector('svg')
    expect(svg?.classList.toString()).toContain('w-8')
  })

  it('has accessible label', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
  })

  it('has animation class', () => {
    render(<LoadingSpinner />)
    const svg = screen.getByRole('status').querySelector('svg')
    expect(svg?.classList.toString()).toContain('animate-spin')
  })
})
