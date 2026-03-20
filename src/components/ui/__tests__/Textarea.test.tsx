import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from '../Textarea'

describe('Textarea', () => {
  it('renders with a label', () => {
    render(<Textarea label="Message" id="msg" />)
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
  })

  it('renders without a label', () => {
    render(<Textarea placeholder="Write here..." />)
    expect(screen.getByPlaceholderText('Write here...')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<Textarea label="Bio" id="bio" error="Too long" />)
    expect(screen.getByText('Too long')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<Textarea label="Bio" id="bio" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('has correct default rows', () => {
    render(<Textarea label="Bio" id="bio" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '3')
  })

  it('accepts custom rows prop', () => {
    render(<Textarea label="Bio" id="bio" rows={6} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6')
  })
})
