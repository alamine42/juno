import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../Input'

describe('Input', () => {
  it('renders with a label', () => {
    render(<Input label="Email" id="email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders without a label', () => {
    render(<Input placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<Input label="Email" id="email" error="Required field" />)
    expect(screen.getByText('Required field')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not show error when error prop is empty', () => {
    render(<Input label="Email" id="email" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<Input label="Email" id="email" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('applies maxLength attribute', () => {
    render(<Input label="Name" id="name" maxLength={255} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '255')
  })

  it('has focus ring styling class', () => {
    render(<Input label="Name" id="name" />)
    expect(screen.getByRole('textbox').className).toContain('focus:ring')
  })
})
