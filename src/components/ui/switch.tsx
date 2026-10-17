"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-border/80 bg-surface-inset shadow-[inset_0_1px_3px_hsl(var(--depth-shadow)/0.35)] transition-[background-color,border-color,box-shadow] outline-none data-[state=checked]:border-border data-[state=checked]:bg-surface-interactive data-[state=unchecked]:bg-surface-inset hover:border-foreground/25 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-45",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-foreground/90 shadow-[0_1px_3px_hsl(var(--depth-shadow)/0.45)] ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
