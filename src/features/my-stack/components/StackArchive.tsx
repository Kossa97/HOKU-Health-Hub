import { forwardRef, type ComponentPropsWithoutRef } from 'react'

export interface StackArchiveProps extends Omit<ComponentPropsWithoutRef<'div'>, 'role'> {
  labelledBy: string
}

export const StackArchive = forwardRef<HTMLDivElement, StackArchiveProps>(function StackArchive(
  { labelledBy, className = '', children, ...rest },
  ref,
) {

  return (
    <div
      {...rest}
      ref={ref}
      data-archive-fullscreen
      data-app-modal
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`fixed inset-0 z-50 flex min-h-dvh flex-col bg-black ${className}`}
    >
      {children}
    </div>
  )
})
