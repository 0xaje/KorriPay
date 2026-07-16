import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg cursor-pointer";

    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-98",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-98",
      outline:
        "border border-border bg-transparent text-foreground hover:bg-secondary/30 active:scale-98",
      ghost: "bg-transparent text-foreground hover:bg-secondary/40",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm active:scale-98",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
