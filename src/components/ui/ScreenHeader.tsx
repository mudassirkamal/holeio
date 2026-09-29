"use client";

import { useApp } from "@/store/app";
import { totalStars, useProfile } from "@/store/profile";
import { Button } from "./Button";
import { CoinBadge, StarBadge } from "./Badges";

export function Currency() {
  const coins = useProfile((s) => s.coins);
  const stars = useProfile((s) => totalStars(s.levelStars));
  return (
    <div className="flex items-center gap-2">
      <StarBadge amount={stars} />
      <CoinBadge amount={coins} />
    </div>
  );
}

export function ScreenHeader({ title }: { title: string }) {
  const go = useApp((s) => s.go);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="md" onClick={() => go("menu")} aria-label="Back">
          ←
        </Button>
        <h1 className="font-display text-3xl tracking-wide text-outline sm:text-5xl">{title}</h1>
      </div>
      <div className="hidden sm:block">
        <Currency />
      </div>
    </div>
  );
}
