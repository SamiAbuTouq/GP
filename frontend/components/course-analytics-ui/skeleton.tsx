import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted/15 animate-shimmer rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
