import { SKIN_BY_ID, type SkinDef, type SkinId } from "@/game/config/skins";

export function CoinBadge({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-4 font-display text-xl ring-1 ring-white/15 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-[#ffe16b] to-[#f59e0b] text-base text-[#7a4300] shadow-inner">
        ¢
      </span>
      {amount.toLocaleString()}
    </div>
  );
}

export function StarBadge({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-4 font-display text-xl ring-1 ring-white/15 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-[#fff3a3] to-[#ffb703] text-lg">★</span>
      {amount}
    </div>
  );
}

export function Stars({ count, max = 3, size = "text-2xl", animate = false }: { count: number; max?: number; size?: string; animate?: boolean }) {
  return (
    <div className={`flex gap-1 ${size}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`${i < count ? "text-[#ffc93c] drop-shadow-[0_2px_6px_rgba(255,180,0,0.6)]" : "text-white/20"} ${animate && i < count ? "animate-pop" : ""}`}
          style={animate ? { animationDelay: `${0.25 + i * 0.25}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/** CSS approximation of a skin's rim, used in menus. */
export function skinBackground(skin: SkinDef) {
  const [a, b, c] = skin.colors;
  switch (skin.pattern) {
    case "rainbow":
      return "conic-gradient(#ff3b3b, #ffb13b, #f7ff3b, #3bff6a, #3bd8ff, #6a3bff, #ff3bd8, #ff3b3b)";
    case "stripes":
      return `repeating-conic-gradient(${a} 0deg 10deg, ${b} 10deg 20deg)`;
    case "checker":
      return `repeating-conic-gradient(${a} 0deg 7.5deg, ${b} 7.5deg 15deg)`;
    case "dots":
      return `radial-gradient(circle at 30% 30%, ${b} 12%, transparent 13%) 0 0 / 22% 22%, radial-gradient(circle at 70% 70%, ${c} 12%, transparent 13%) 0 0 / 22% 22%, ${a}`;
    case "gradient":
    case "pulse":
      return `conic-gradient(${a}, ${b}, ${c}, ${a})`;
    case "galaxy":
      return `radial-gradient(circle at 30% 25%, ${c} 0 6%, transparent 30%), radial-gradient(circle at 70% 65%, ${a} 0 10%, transparent 45%), ${b}`;
    case "lava":
    case "toxic":
      return `radial-gradient(circle at 35% 30%, ${c}, ${a} 45%, ${b} 90%)`;
    case "gold":
      return `conic-gradient(${b}, ${a}, ${c}, ${a}, ${b}, ${a}, ${c}, ${b})`;
    case "ice":
      return `conic-gradient(${a}, ${c}, ${b}, ${a}, ${c}, ${a})`;
    case "electric":
      return `conic-gradient(${b}, ${a}, ${c}, ${b}, ${a}, ${b})`;
    case "matrix":
      return `repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 7px)`;
    default:
      return `radial-gradient(circle at 35% 30%, ${c}, ${a} 55%, ${b})`;
  }
}

export function SkinSwatch({ skinId, size = 56, spin = false }: { skinId: SkinId; size?: number; spin?: boolean }) {
  const skin = SKIN_BY_ID[skinId];
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: skinBackground(skin),
        boxShadow: `0 0 ${Math.round(size * 0.3 * skin.glow)}px ${skin.colors[0]}88`,
        animation: spin ? "spin 6s linear infinite" : undefined,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          inset: size * 0.14,
          background: "radial-gradient(circle at 50% 35%, #1a1a2e, #000 70%)",
          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.9)",
        }}
      />
    </div>
  );
}
