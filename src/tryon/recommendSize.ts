import { Profile, SizeChartEntry } from "./types";

export type RecommendationStatus =
  | "no-chart"
  | "missing-measurement"
  | "match"
  | "between-sizes"
  | "smaller-than-all"
  | "larger-than-all";

export interface SizeRecommendation {
  status: RecommendationStatus;
  recommendedSize?: string;
  targetChestCm?: number;
  message: string;
  isBetweenSizes?: boolean;
  lowerSize?: string;
  upperSize?: string;
  shoulderWarning?: string;
}

export function recommendSize(
  profile: Profile,
  chart?: SizeChartEntry[]
): SizeRecommendation {
  if (!chart || chart.length === 0) {
    return {
      status: "no-chart",
      message: "Size chart not available",
    };
  }

  if (
    profile.chestCm === undefined ||
    profile.chestCm === null ||
    !Number.isFinite(profile.chestCm)
  ) {
    return {
      status: "missing-measurement",
      message: "Add your chest measurement",
    };
  }

  const userChest = profile.chestCm;
  const targetChest = userChest + 4; // Comfort ease rule

  const sorted = [...chart].sort((a, b) => a.chestCm - b.chestCm);

  // Case 1: Smaller than all sizes in chart
  if (targetChest < sorted[0].chestCm) {
    const chosen = sorted[0];
    const rec: SizeRecommendation = {
      status: "smaller-than-all",
      recommendedSize: chosen.size,
      targetChestCm: targetChest,
      message: `Your chest with comfort ease (${targetChest} cm) is smaller than size ${chosen.size} (${chosen.chestCm} cm). It may fit relaxed.`,
    };
    checkShoulder(rec, chosen, profile.shoulderCm);
    return rec;
  }

  // Case 2: Larger than all sizes in chart
  const largest = sorted[sorted.length - 1];
  if (targetChest > largest.chestCm) {
    return {
      status: "larger-than-all",
      targetChestCm: targetChest,
      message: `Your chest with comfort ease (${targetChest} cm) exceeds the largest size ${largest.size} (${largest.chestCm} cm).`,
    };
  }

  // Case 3: Match or between sizes
  const index = sorted.findIndex((item) => item.chestCm >= targetChest);
  const chosen = sorted[index];

  if (chosen.chestCm === targetChest) {
    const rec: SizeRecommendation = {
      status: "match",
      recommendedSize: chosen.size,
      targetChestCm: targetChest,
      message: `Size ${chosen.size} is an exact match for your chest (${userChest} cm) with +4 cm comfort ease.`,
    };
    checkShoulder(rec, chosen, profile.shoulderCm);
    return rec;
  }

  // Strictly between sorted[index - 1] and sorted[index]
  const lower = sorted[index - 1];
  const rec: SizeRecommendation = {
    status: "between-sizes",
    recommendedSize: chosen.size,
    isBetweenSizes: true,
    lowerSize: lower.size,
    upperSize: chosen.size,
    targetChestCm: targetChest,
    message: `You are between sizes ${lower.size} and ${chosen.size}. Pick ${chosen.size} for a relaxed fit, or ${lower.size} for a closer fit.`,
  };
  checkShoulder(rec, chosen, profile.shoulderCm);
  return rec;
}

function checkShoulder(
  rec: SizeRecommendation,
  entry: SizeChartEntry,
  userShoulder?: number
) {
  if (
    userShoulder !== undefined &&
    entry.shoulderCm !== undefined &&
    entry.shoulderCm < userShoulder - 2
  ) {
    rec.shoulderWarning = `Shoulders on size ${entry.size} (${entry.shoulderCm} cm) are more than 2 cm narrower than yours (${userShoulder} cm).`;
  }
}
