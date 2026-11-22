export type Deal = {
  id: string;
  title: string;
  price: number;
  store: "Amazon" | "Flipkart" | "AJIO" | "Myntra" | string;
  imageUrl: string;
  buyUrl: string;
  tryOnMode: "flat" | "model"; // "flat" = plain-background product photo
};

export type Profile = {
  heightCm: number;                      // 140-200, default 170
  build: "slim" | "regular" | "broad";   // default "regular"
  skin: string;                          // hex, one of 6 presets
};

export const SKIN_PRESETS: readonly string[] = [
  "#FCE2D4", // 1. Fair
  "#EDBE9E", // 2. Light Warm
  "#D09B74", // 3. Medium Olive
  "#A36B42", // 4. Almond Tan
  "#6E3B20", // 5. Deep Bronze
  "#391F13", // 6. Rich Espresso
];

export const DEFAULT_PROFILE: Profile = {
  heightCm: 170,
  build: "regular",
  skin: "#D09B74",
};

export type FitType = "slim" | "regular" | "oversized";

export const FIT_FACTORS: Record<FitType, number> = {
  slim: 0.95,
  regular: 1.05,
  oversized: 1.25,
};
