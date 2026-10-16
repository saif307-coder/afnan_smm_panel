/**
 * Strict Mathematical Engine for Instagram Reel Insights
 * Enforces deterministic, verified ratio constraints across all views & durations.
 */

export interface CountryMetric {
  country: string;
  percentage: number;
}

export interface GraphDataPoint {
  time: string;
  step: number;
  all: number;
  followers: number;
  nonFollowers: number;
}

export interface GraphYAxisTicks {
  maxScale: number;
  topTick: string;
  topTickValue: number;
  midTick: string;
  midTickValue: number;
  zeroTick: string;
}

export interface ReelMetricsResult {
  views: number;
  viewers: number;
  watchTimeRatio: number;
  avgWatchTimeSeconds: number;
  totalWatchTimeMinutes: number;
  viewersPercentage: number;
  follows: number;
  followersPercentage: number;
  nonFollowersPercentage: number;
  countries: CountryMetric[];
  countriesJson: string;
  graphData: GraphDataPoint[];
  graphDataJson: string;
  ticks: GraphYAxisTicks;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 * Ensures repeatable metrics for identical seeds (prevents UI flicker)
 */
function createSeededRandom(seedInput: number | string): () => number {
  let h = 2166136261 >>> 0;
  const str = String(seedInput);
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  let s = h >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Format numbers into compact strings with K and M suffix (e.g., 100K, 1.5M)
 */
export function formatMetricNumber(num: number): string {
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M`;
  }
  if (num >= 1_000) {
    const formatted = (num / 1_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}K`;
  }
  return num.toLocaleString();
}

/**
 * Calculate deterministic Reel metrics adhering to strict business constraints:
 * 1. Viewers: 65% - 70% of views
 * 2. Average Watch Time: 40s - 45s per 60s video (scaled proportionally)
 * 3. Follows: 20 - 25 per 100,000 views
 * 4. Countries: Strict descending order [USA/United States (26.4-31.2%), UK (18.1-21.5%), Canada (12.4-15.0%), Australia (7.8-10.2%), Germany (4.2-6.5%)]
 * 5. Dynamic 12-point velocity curve with midTick (~75%) and topTick (~150%)
 */
export function calculateReelMetrics(
  views: number,
  videoDurationSeconds: number = 60,
  seedString?: string,
  countryLabelFormat: 'USA' | 'United States' = 'USA'
): ReelMetricsResult {
  const safeViews = Math.max(0, Math.floor(views));
  const safeDuration = Math.max(1, Math.floor(videoDurationSeconds));
  const seed = seedString ?? `reel_metrics_${safeViews}_${safeDuration}`;
  const rng = createSeededRandom(seed);

  // 1. Viewers Ratio (Strictly 67.5% Unique Viewers / Accounts Reached on Every Order)
  const viewerRatio = 0.675;
  const viewers = Math.round(safeViews * viewerRatio);

  // 2. Average Watch Time (Strictly 0.7 ratio = 42s per 60s video, proportional)
  const watchTimeRatio = 0.7;
  const avgWatchTimeSeconds = Math.max(
    1,
    Math.min(safeDuration, Math.round(safeDuration * watchTimeRatio))
  );
  const totalWatchTimeMinutes = Math.round(safeViews * watchTimeRatio);

  // 3. Follows Ratio (Strictly 20 to 25 per 100,000 views)
  const followsRatio = 20 + rng() * 5;
  const follows = Math.round((safeViews / 100000) * followsRatio);

  // Follower vs Non-Follower Percentages (Standard Reel distribution: ~0.4% / 99.6%)
  const followersPercentage = 0.4;
  const nonFollowersPercentage = 99.6;

  // 4. Top Countries (Strictly Descending Order)
  // USA: 26.4% - 31.2%
  // UK: 18.1% - 21.5%
  // Canada: 12.4% - 15.0%
  // Australia: 7.8% - 10.2%
  // Germany: 4.2% - 6.5%
  const usaPercentage = Number((26.4 + rng() * 4.8).toFixed(1));
  const ukPercentage = Number((18.1 + rng() * 3.4).toFixed(1));
  const canadaPercentage = Number((12.4 + rng() * 2.6).toFixed(1));
  const australiaPercentage = Number((7.8 + rng() * 2.4).toFixed(1));
  const germanyPercentage = Number((4.2 + rng() * 2.3).toFixed(1));

  const usaLabel = countryLabelFormat === 'United States' ? 'United States' : 'USA';

  const countries: CountryMetric[] = [
    { country: usaLabel, percentage: usaPercentage },
    { country: 'UK', percentage: ukPercentage },
    { country: 'Canada', percentage: canadaPercentage },
    { country: 'Australia', percentage: australiaPercentage },
    { country: 'Germany', percentage: germanyPercentage },
  ];

  // 5. Dynamic Graph Data (12-point Instagram Reel velocity curve: steep rise -> plateau)
  const timeLabels = ['1h', '2h', '4h', '8h', '12h', '24h', '2d', '3d', '4d', '5d', '6d', '7d'];
  // Normalized velocity curve progression reaching 1.0 (100%) at the 12th point
  const velocityProgression = [
    0.08,  // 1h
    0.22,  // 2h
    0.41,  // 4h
    0.59,  // 8h
    0.73,  // 12h
    0.83,  // 24h
    0.90,  // 2d
    0.945, // 3d
    0.972, // 4d
    0.988, // 5d
    0.996, // 6d
    1.000, // 7d
  ];

  const graphData: GraphDataPoint[] = velocityProgression.map((progress, idx) => {
    // Add small deterministic jitter for natural realism except at final point
    const jitter = idx === 11 ? 0 : (rng() - 0.5) * 0.008;
    const effectiveProgress = Math.min(1.0, Math.max(0.01, progress + jitter));
    const all = Math.round(safeViews * effectiveProgress);
    const followerCount = Math.round(all * (followersPercentage / 100));
    const nonFollowerCount = all - followerCount;

    return {
      time: timeLabels[idx],
      step: idx + 1,
      all,
      followers: followerCount,
      nonFollowers: nonFollowerCount,
    };
  });

  // Ticks: midTick (~75% of views) and topTick (~150% of views)
  const topTickValue = Math.round(safeViews * 1.5);
  const midTickValue = Math.round(safeViews * 0.75);

  const ticks: GraphYAxisTicks = {
    maxScale: topTickValue,
    topTick: formatMetricNumber(topTickValue),
    topTickValue,
    midTick: formatMetricNumber(midTickValue),
    midTickValue,
    zeroTick: '0',
  };

  return {
    views: safeViews,
    viewers,
    watchTimeRatio,
    avgWatchTimeSeconds,
    totalWatchTimeMinutes,
    viewersPercentage: 67.5,
    follows,
    followersPercentage,
    nonFollowersPercentage,
    countries,
    countriesJson: JSON.stringify(countries),
    graphData,
    graphDataJson: JSON.stringify(graphData),
    ticks,
  };
}
