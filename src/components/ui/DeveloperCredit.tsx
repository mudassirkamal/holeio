import { DEVELOPER } from "@/game/config/constants";

/** "Developed by …" line with the developer's name and a mailto link highlighted. */
export function DeveloperCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`inline-block rounded-2xl bg-black/50 px-3 py-1.5 text-xs font-bold leading-relaxed text-white/85 ring-1 ring-white/10 backdrop-blur-sm ${className}`}>
      Developed by <span className="rounded-md bg-[#ffe066]/15 px-1.5 py-0.5 font-display text-sm tracking-wide text-[#ffe066]">{DEVELOPER.name}</span>
      {" · "}
      <a
        href={`mailto:${DEVELOPER.email}`}
        className="rounded-md bg-[#4fd6ff]/15 px-1.5 py-0.5 text-[#7fe3ff] underline-offset-2 transition hover:underline"
      >
        {DEVELOPER.email}
      </a>
    </p>
  );
}
