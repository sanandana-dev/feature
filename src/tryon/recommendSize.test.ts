import { describe, it, expect } from "vitest";
import { recommendSize } from "./recommendSize";
import { Profile, SizeChartEntry } from "./types";

const MOCK_CHART: SizeChartEntry[] = [
  { size: "S", chestCm: 96, shoulderCm: 42 },
  { size: "M", chestCm: 104, shoulderCm: 45 },
  { size: "L", chestCm: 112, shoulderCm: 48 },
  { size: "XL", chestCm: 120, shoulderCm: 51 },
];

const BASE_PROFILE: Profile = {
  heightCm: 175,
  build: "regular",
  skin: "#D09B74",
};

describe("recommendSize pure function", () => {
  it("handles missing data: no size chart", () => {
    const res = recommendSize({ ...BASE_PROFILE, chestCm: 96 }, undefined);
    expect(res.status).toBe("no-chart");
    expect(res.message).toBe("Size chart not available");
  });

  it("handles missing data: empty size chart", () => {
    const res = recommendSize({ ...BASE_PROFILE, chestCm: 96 }, []);
    expect(res.status).toBe("no-chart");
    expect(res.message).toBe("Size chart not available");
  });

  it("handles missing data: missing user chest measurement", () => {
    const res = recommendSize(BASE_PROFILE, MOCK_CHART);
    expect(res.status).toBe("missing-measurement");
    expect(res.message).toBe("Add your chest measurement");
  });

  it("handles exact match (user chest 100 + 4 ease = 104 cm -> Size M)", () => {
    const res = recommendSize({ ...BASE_PROFILE, chestCm: 100 }, MOCK_CHART);
    expect(res.status).toBe("match");
    expect(res.recommendedSize).toBe("M");
    expect(res.targetChestCm).toBe(104);
    expect(res.isBetweenSizes).toBeFalsy();
  });

  it("handles between sizes (user chest 95 + 4 ease = 99 cm -> between S and M)", () => {
    const res = recommendSize({ ...BASE_PROFILE, chestCm: 95 }, MOCK_CHART);
    expect(res.status).toBe("between-sizes");
    expect(res.isBetweenSizes).toBe(true);
    expect(res.recommendedSize).toBe("M");
    expect(res.lowerSize).toBe("S");
    expect(res.upperSize).toBe("M");
    expect(res.message).toContain("between sizes S and M");
  });

  it("handles smaller than all sizes (user chest 85 + 4 ease = 89 cm < S 96 cm)", () => {
    const res = recommendSize({ ...BASE_PROFILE, chestCm: 85 }, MOCK_CHART);
    expect(res.status).toBe("smaller-than-all");
    expect(res.recommendedSize).toBe("S");
    expect(res.targetChestCm).toBe(89);
  });

  it("handles larger than all sizes (user chest 125 + 4 ease = 129 cm > XL 120 cm)", () => {
    const res = recommendSize({ ...BASE_PROFILE, chestCm: 125 }, MOCK_CHART);
    expect(res.status).toBe("larger-than-all");
    expect(res.recommendedSize).toBeUndefined();
    expect(res.message).toContain("exceeds the largest size");
  });

  it("flags narrow shoulders when shoulderCm is > 2 cm narrower than user", () => {
    // User shoulder 48, Size S shoulder is 42 (diff 6 cm > 2 cm)
    const res = recommendSize(
      { ...BASE_PROFILE, chestCm: 90, shoulderCm: 48 }, // 90 + 4 = 94 -> Size S (shoulder 42)
      MOCK_CHART
    );
    expect(res.recommendedSize).toBe("S");
    expect(res.shoulderWarning).toBeDefined();
    expect(res.shoulderWarning).toContain("more than 2 cm narrower");
  });
});
