"use client";

import { useEffect, useState } from "react";
import { audio } from "@/game/audio/AudioEngine";
import { RARITY_COLORS, SKINS, SKIN_BY_ID, type SkinDef, type SkinId } from "@/game/config/skins";
import { useApp } from "@/store/app";
import { isSkinUnlocked, totalStars, useProfile } from "@/store/profile";
import { SkinSwatch } from "../ui/Badges";
import { Button } from "../ui/Button";
import { ScreenHeader } from "../ui/ScreenHeader";

function lockText(skin: SkinDef) {
  switch (skin.unlock.type) {
    case "coins":
      return `¢${skin.unlock.price}`;
    case "level":
      return `Clear level ${skin.unlock.level}`;
    case "stars":
      return `Collect ${skin.unlock.stars} ★`;
    default:
      return "Free";
  }
}

export default function SkinShop() {
  const profile = useProfile();
  const setPreviewSkin = useApp((s) => s.setPreviewSkin);
  const [focused, setFocused] = useState<SkinId>(profile.selectedSkin);
  const skin = SKIN_BY_ID[focused];
  const unlocked = isSkinUnlocked(skin, profile);
  const stars = totalStars(profile.levelStars);

  useEffect(() => {
    setPreviewSkin(focused);
  }, [focused, setPreviewSkin]);

  const action = () => {
    if (unlocked) {
      profile.selectSkin(focused);
    } else if (skin.unlock.type === "coins" && profile.buySkin(focused)) {
      audio.purchase();
    }
  };

  const canBuy = skin.unlock.type === "coins" && profile.coins >= skin.unlock.price;

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-8 short:gap-3 short:p-3">
      <ScreenHeader title="Skins" />
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:flex-row short:flex-row short:gap-3">
        <div className="panel min-h-0 flex-1 overflow-y-auto rounded-3xl p-4 scrollbar-thin lg:max-w-xl short:max-w-[46%] short:p-3">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {SKINS.map((s) => {
              const owned = isSkinUnlocked(s, profile);
              const selected = profile.selectedSkin === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setFocused(s.id)}
                  className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl p-3 transition hover:bg-white/10 ${focused === s.id ? "bg-white/15 ring-2 ring-white" : "bg-black/20"}`}
                  style={{ boxShadow: `inset 0 -3px 0 ${RARITY_COLORS[s.rarity]}` }}
                >
                  <div className={owned ? "" : "opacity-45 grayscale-[0.5]"}>
                    <SkinSwatch skinId={s.id} size={58} />
                  </div>
                  <span className="text-center font-display text-sm leading-tight">{s.name}</span>
                  {selected && <span className="absolute right-1.5 top-1.5 rounded-full bg-lime px-1.5 text-xs font-black text-ink">✓</span>}
                  {!owned && <span className="absolute left-1.5 top-1.5 text-sm">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-end gap-3 lg:justify-center short:items-end short:justify-end">
          <div className="panel w-full max-w-sm rounded-3xl p-5 text-center animate-rise short:max-w-72 short:p-3">
            <div className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: RARITY_COLORS[skin.rarity] }}>
              {skin.rarity}
            </div>
            <h2 className="font-display text-4xl short:text-2xl">{skin.name}</h2>
            <p className="mt-1 text-sm font-bold text-white/65">
              {skin.particles !== "none" ? `Animated · ${skin.particles} trail` : skin.pattern === "solid" ? "Classic glow" : "Animated pattern"}
            </p>
            <div className="mt-4 short:mt-2">
              {profile.selectedSkin === focused ? (
                <Button variant="green" size="lg" className="w-full" disabled>
                  Equipped
                </Button>
              ) : unlocked ? (
                <Button variant="secondary" size="lg" className="w-full" onClick={action}>
                  Equip
                </Button>
              ) : skin.unlock.type === "coins" ? (
                <Button variant="gold" size="lg" className="w-full" disabled={!canBuy} onClick={action}>
                  Buy ¢{skin.unlock.price}
                </Button>
              ) : (
                <div className="rounded-2xl bg-black/30 px-4 py-3 font-display text-xl">
                  🔒 {lockText(skin)}
                  {skin.unlock.type === "stars" && <div className="text-sm text-white/60">You have {stars} ★</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
