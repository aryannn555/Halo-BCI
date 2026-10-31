import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-halo-left focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-white text-black hover:bg-white/80",
        secondary:
          "border-transparent bg-halo-surface2 text-white hover:bg-halo-surface3",
        destructive:
          "border-transparent bg-halo-error text-white hover:bg-halo-error/80",
        outline: "text-halo-muted border-halo-border",
        left: "border-halo-left/30 bg-halo-left/10 text-halo-left",
        right: "border-halo-right/30 bg-halo-right/10 text-halo-right",
        success: "border-halo-success/30 bg-halo-success/10 text-halo-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
