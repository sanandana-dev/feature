import { useState, useEffect, useRef } from "react";
import { Profile, DEFAULT_PROFILE, SKIN_PRESETS } from "./types";

const STORAGE_KEY = "dealfinder.tryon.profile";

function sanitizeProfile(raw: unknown): Profile {
  if (!raw || typeof raw !== "object") return DEFAULT_PROFILE;
  const candidate = raw as Partial<Profile>;

  const rawHeight = Number(candidate.heightCm);
  const heightCm = Number.isFinite(rawHeight)
    ? Math.min(200, Math.max(140, Math.round(rawHeight)))
    : DEFAULT_PROFILE.heightCm;

  const build =
    candidate.build === "slim" || candidate.build === "broad" || candidate.build === "regular"
      ? candidate.build
      : DEFAULT_PROFILE.build;

  const skin =
    typeof candidate.skin === "string" && SKIN_PRESETS.includes(candidate.skin)
      ? candidate.skin
      : DEFAULT_PROFILE.skin;

  const rawChest =
    candidate.chestCm !== undefined && candidate.chestCm !== null
      ? Number(candidate.chestCm)
      : undefined;
  const chestCm =
    rawChest !== undefined && Number.isFinite(rawChest)
      ? Math.min(140, Math.max(70, Math.round(rawChest)))
      : undefined;

  const rawShoulder =
    candidate.shoulderCm !== undefined && candidate.shoulderCm !== null
      ? Number(candidate.shoulderCm)
      : undefined;
  const shoulderCm =
    rawShoulder !== undefined && Number.isFinite(rawShoulder)
      ? Math.min(60, Math.max(30, Math.round(rawShoulder)))
      : undefined;

  return { heightCm, build, skin, chestCm, shoulderCm };
}

export function useProfile(): {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  isFirstTime: boolean;
} {
  const [isFirstTime, setIsFirstTime] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === null;
    } catch {
      return true;
    }
  });

  const [profile, setProfile] = useState<Profile>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_PROFILE;
      return sanitizeProfile(JSON.parse(stored));
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        setIsFirstTime(false);
      } catch (err) {
        console.warn("Storage write failed:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [profile]);

  return { profile, setProfile, isFirstTime };
}
