import * as React from "react";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  clean?: boolean;
}

export function Container({ className = "", clean = false, ...props }: ContainerProps) {
  return (
    <div
      className={`${clean ? "" : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"} ${className}`}
      {...props}
    />
  );
}

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 12;
}

export function Grid({ className = "", cols = 3, ...props }: GridProps) {
  const colStyles = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    12: "grid-cols-12",
  };

  return <div className={`grid gap-6 ${colStyles[cols]} ${className}`} {...props} />;
}
