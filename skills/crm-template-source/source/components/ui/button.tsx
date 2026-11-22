import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Buttons follow the component tokens: primary is Olive solid with white
 * (one per view), secondary is the default for toolbars, soft accepts a
 * suggestion, danger is Clay ink text (never a clay solid button).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-[var(--ky-component-button-gap)] rounded-[var(--ky-component-button-radius)] text-[13px] font-semibold whitespace-nowrap transition-[background-color,box-shadow] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[14px]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ky-component-button-primary-bg)] text-[var(--ky-component-button-primary-fg)] hover:shadow-[inset_0_0_0_9999px_var(--ky-color-state-press)]",
        primary:
          "bg-[var(--ky-component-button-primary-bg)] text-[var(--ky-component-button-primary-fg)] hover:shadow-[inset_0_0_0_9999px_var(--ky-color-state-press)]",
        secondary:
          "bg-[var(--ky-component-button-secondary-bg)] text-[var(--ky-component-button-secondary-fg)] shadow-[var(--ky-component-button-secondary-shadow)] hover:bg-[color-mix(in_oklab,var(--ky-component-button-secondary-bg),var(--ky-color-text-primary)_4%)]",
        outline:
          "bg-[var(--ky-component-button-secondary-bg)] text-[var(--ky-component-button-secondary-fg)] shadow-[var(--ky-component-button-secondary-shadow)] hover:bg-[color-mix(in_oklab,var(--ky-component-button-secondary-bg),var(--ky-color-text-primary)_4%)]",
        soft: "bg-[var(--ky-component-button-soft-bg)] text-[var(--ky-component-button-soft-fg)] hover:shadow-[inset_0_0_0_9999px_var(--ky-color-state-hover)]",
        danger: "bg-transparent text-[var(--ky-component-button-danger-fg)] hover:bg-ky-hover",
        destructive: "bg-transparent text-[var(--ky-component-button-danger-fg)] hover:bg-ky-hover",
        ghost: "bg-transparent text-ky-ink hover:bg-ky-hover",
        link: "h-auto px-0 text-ky-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--ky-component-button-height)] px-[var(--ky-component-button-padding-x)]",
        sm: "h-8 rounded-[10px] px-3",
        xs: "h-6 gap-1 rounded-[8px] px-2 text-[12px] [&_svg:not([class*='size-'])]:size-3",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[8px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[10px]",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "secondary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
