import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

type Variant = "primary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function Button({
  pending,
  disabled,
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      className={cn(
        "btn",
        variantClasses[variant],
        pending && "opacity-80 cursor-wait",
        className,
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? stripLeadingIcon(children) : children}
    </button>
  );
}

function stripLeadingIcon(children: React.ReactNode): React.ReactNode {
  if (!Array.isArray(children)) return children;
  const arr = React.Children.toArray(children);
  const first = arr[0];
  if (
    React.isValidElement(first) &&
    typeof first.type !== "string" &&
    (first.type as any)?.displayName?.toLowerCase().includes("icon") === false
  ) {
    return arr.slice(1);
  }
  if (React.isValidElement(first)) {
    return arr.slice(1);
  }
  return arr;
}
