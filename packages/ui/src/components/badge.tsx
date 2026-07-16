import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success";
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "text-foreground border-border",
    destructive:
      "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    success: "border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80",
  };

  return <div className={`${baseStyles} ${variants[variant]} ${className}`} {...props} />;
}
