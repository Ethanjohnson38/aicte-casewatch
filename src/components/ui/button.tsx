import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-[background-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50 disabled:pointer-events-none active:translate-y-px";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-card",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-sunken shadow-card",
  ghost: "text-ink-muted hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-accent border border-accent/30 hover:bg-accent-weak",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />;
}
