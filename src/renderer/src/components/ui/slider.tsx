import React from 'react'
import { cn } from '@renderer/lib/utils'

export type SliderProps = React.InputHTMLAttributes<HTMLInputElement>

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(({ className, ...props }, ref) => (
  <input
    type="range"
    className={cn('w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-secondary', className)}
    ref={ref}
    {...props}
  />
))
Slider.displayName = 'Slider'

export { Slider }
