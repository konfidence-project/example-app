import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

import styles from "./button.module.css";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm" | "icon";

const classes = (variant: Variant, size: Size, extra?: string) =>
  [styles.button, styles[variant], styles[size], extra].filter(Boolean).join(" ");

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...rest} />;
}

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={classes(variant, size, className)} {...rest} />;
}
