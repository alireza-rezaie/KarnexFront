import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-medium outline-none transition-all duration-200 active:translate-y-px active:scale-[0.99] disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "border-border/75 bg-surface-interactive text-foreground shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.05),0_4px_10px_hsl(var(--depth-shadow)/0.24)] hover:-translate-y-px hover:border-border hover:bg-accent hover:shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.06),0_7px_14px_hsl(var(--depth-shadow)/0.3)] active:bg-surface-inset active:shadow-[inset_0_2px_5px_hsl(var(--depth-shadow)/0.42)]",
        destructive:
          "border-destructive/35 bg-destructive/10 text-destructive shadow-[inset_0_1px_0_hsl(0_0%_100%/0.035),0_3px_8px_hsl(var(--depth-shadow)/0.18)] hover:-translate-y-px hover:border-destructive/50 hover:bg-destructive/15 active:bg-destructive/10 active:shadow-[inset_0_2px_5px_hsl(var(--depth-shadow)/0.4)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/70 bg-surface-interactive text-foreground shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.04),0_3px_8px_hsl(var(--depth-shadow)/0.22)] hover:-translate-y-px hover:border-border hover:bg-accent active:bg-surface-inset active:shadow-[inset_0_2px_5px_hsl(var(--depth-shadow)/0.45)]",
        secondary:
          "border-border/60 bg-surface-interactive text-secondary-foreground shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.04),0_3px_8px_hsl(var(--depth-shadow)/0.2)] hover:-translate-y-px hover:bg-accent active:bg-surface-inset active:shadow-[inset_0_2px_5px_hsl(var(--depth-shadow)/0.42)]",
        surface:
          "border-border/75 bg-surface-interactive text-foreground shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.05),0_4px_10px_hsl(var(--depth-shadow)/0.24)] hover:-translate-y-px hover:border-border hover:bg-accent active:bg-surface-inset active:shadow-[inset_0_2px_5px_hsl(var(--depth-shadow)/0.42)]",
        ghost:
          "text-muted-foreground hover:-translate-y-px hover:border-border/50 hover:bg-surface-interactive hover:text-foreground hover:shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/0.035),0_3px_8px_hsl(var(--depth-shadow)/0.18)] active:bg-surface-inset active:shadow-[inset_0_2px_4px_hsl(var(--depth-shadow)/0.4)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shared variant API is consumed across the existing UI.
export { Button, buttonVariants }
