import React from "react";
import { cn } from "../../lib/utils";
import "./skeleton.css";

const Skeleton = React.forwardRef(({ className, style, ...props }, ref) => {
  const combinedClassName = className ? `skeleton ${className}` : "skeleton";
  return (
    <div
      ref={ref}
      className={combinedClassName}
      style={style}
      {...props}
    />
  );
});

Skeleton.displayName = "Skeleton";

export { Skeleton };

