import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "burgundy";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-burgundy-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          {
            "bg-burgundy text-white hover:bg-accent-hover hover:shadow-burgundy border border-burgundy-500/30":
              variant === "burgundy" || variant === "primary",
            "bg-surface text-white hover:bg-surface-hover border border-surface-border":
              variant === "secondary",
            "border border-white/20 text-white hover:bg-white/10":
              variant === "outline",
            "text-white/80 hover:text-white hover:bg-white/5":
              variant === "ghost",
            "h-8 px-3 text-xs": size === "sm",
            "h-11 px-5 text-sm": size === "md",
            "h-13 px-8 text-base tracking-wide": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
