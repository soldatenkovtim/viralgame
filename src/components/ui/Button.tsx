import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-violet-accent text-white hover:bg-violet-soft active:bg-violet-accent border border-violet-accent',
  secondary:
    'bg-ink-850 text-chalk-50 border border-ink-600 hover:border-ink-500 hover:bg-ink-800',
  ghost:
    'bg-transparent text-chalk-400 border border-transparent hover:text-chalk-50 hover:bg-ink-850',
  danger:
    'bg-transparent text-market-down border border-ink-700 hover:border-market-down/50 hover:bg-ink-850',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-7 text-base',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className = '',
  children,
  onClick,
}: {
  to: string
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  className?: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </Link>
  )
}
