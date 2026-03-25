import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary-10 text-primary hover:bg-primary-20 active:bg-primary-20",
        primary:
          "bg-primary-10 text-primary hover:bg-primary-20 active:bg-primary-20",
        destructive:
          "bg-destructive-10 text-destructive hover:bg-destructive-20 active:bg-destructive-20",
        accent:
          "bg-accent-10 text-accent hover:bg-accent-20 active:bg-accent-20",
        outline:
          "border border-input bg-background/80 text-foreground hover:bg-muted active:bg-muted",
        ghost:
          "text-secondary-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs:  "h-2  px-2   py-1   text-[13px]",
        sm:  "h-8  px-3   py-1.5 text-[13px]",
        md:  "h-8  px-4   py-2",
        lg:  "h-10 px-5   py-2.5",
        xl:  "h-11 px-6   py-3",
        "2xl": "h-12 px-7 py-3.5 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
        default: "h-9 px-4 py-2",
      },
    },
    compoundVariants: [
      {
        variant: ["default", "primary"],
        size: "lg",
        className: "rounded-lg",
      },
      {
        variant: ["default", "primary"],
        size: "xl",
        className: "rounded-lg",
      },
      {
        variant: ["default", "primary"],
        size: "2xl",
        className: "rounded-lg",
      },
      {
        variant: ["default", "primary"],
        size: "xs",
        className: "rounded",
      },
      {
        variant: ["default", "primary"],
        size: "sm",
        className: "rounded",
      },
      {
        variant: "destructive",
        size: "lg",
        className: "rounded-lg",
      },
      {
        variant: "destructive",
        size: "xl",
        className: "rounded-lg",
      },
      {
        variant: "accent",
        size: "lg",
        className: "rounded-lg",
      },
      {
        variant: "accent",
        size: "xl",
        className: "rounded-lg",
      },
      {
        variant: "outline",
        size: "lg",
        className: "rounded-lg border-2",
      },
      {
        variant: "outline",
        size: "xl",
        className: "rounded-lg border-2",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };

