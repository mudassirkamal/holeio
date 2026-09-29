"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { audio } from "@/game/audio/AudioEngine";

type Variant = "primary" | "secondary" | "gold" | "green" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, { className: string; shadow: string }> = {
  primary: { className: "bg-gradient-to-b from-[#ff5c95] to-[#e8175d] text-white", shadow: "#8c0f3b" },
  secondary: { className: "bg-gradient-to-b from-[#4fd6ff] to-[#1f8fe0] text-white", shadow: "#0f4f86" },
  gold: { className: "bg-gradient-to-b from-[#ffd65c] to-[#ff9d00] text-[#4a2600]", shadow: "#9a5a00" },
  green: { className: "bg-gradient-to-b from-[#8df26b] to-[#2fbf4a] text-[#0d3b12]", shadow: "#1b6b2a" },
  ghost: { className: "bg-white/10 text-white border border-white/20", shadow: "rgba(0,0,0,0.35)" },
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-xl",
  md: "px-5 py-2.5 text-lg rounded-2xl",
  lg: "px-7 py-3.5 text-2xl rounded-2xl",
  xl: "px-10 py-4 text-4xl rounded-3xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", icon, className = "", children, onClick, ...rest }: ButtonProps) {
  const v = VARIANTS[variant];
  return (
    <button
      {...rest}
      onClick={(e) => {
        audio.unlock();
        audio.click();
        onClick?.(e);
      }}
      className={`btn-3d inline-flex cursor-pointer items-center justify-center gap-2 font-display tracking-wide text-outline ${v.className} ${SIZES[size]} ${className}`}
      style={{ ["--btn-shadow" as string]: v.shadow }}
    >
      {icon && <span className="leading-none">{icon}</span>}
      {children}
    </button>
  );
}
