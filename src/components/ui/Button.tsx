import { type ButtonHTMLAttributes } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/25 disabled:bg-green-400 active:scale-[0.97] transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md disabled:text-gray-400 active:scale-[0.98] transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out',
  ghost: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:text-gray-400 active:scale-[0.98] transition-[background-color,color,transform] duration-200 ease-out',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}
