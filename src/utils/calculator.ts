/**
 * Mathematical Engine Utility for SMM Order Calculations
 * 
 * Computes exact integer quantities for engagement metrics (Likes, Saves, Shares,
 * Reposts, Comments, Followers) based on Base Views and dynamic percentage ratios.
 */

export interface MetricPercentages {
  likesPercentage: number;
  savesPercentage: number;
  sharesPercentage: number;
  repostsPercentage: number;
  commentsPercentage: number;
  followsPercentage: number;
  viewersPercentage?: number;
  avgWatchTimeRatio?: number;
  customWatchTime?: number;
}

export interface CalculatedQuantities {
  views: number;
  likes: number;
  saves: number;
  shares: number;
  reposts: number;
  comments: number;
  followers: number;
  follows: number; // alias for followers to ensure robust compatibility
  viewers: number;
  watchTimeRatio: number;
  avgWatchTimeSeconds: number;
  totalWatchTimeMinutes: number;
  viewersPercentage: number;
  totalEngagement: number;
  engagementRate: number; // percentage of views that engaged
  customWatchTime?: number;
  watchTimeString: string;
}

export const DEFAULT_PERCENTAGES: MetricPercentages = {
  likesPercentage: 3.4,
  savesPercentage: 2.8,
  sharesPercentage: 0.95,
  repostsPercentage: 0.35,
  commentsPercentage: 0.12,
  followsPercentage: 0.025,
  viewersPercentage: 67.5,
  avgWatchTimeRatio: 0.7,
  customWatchTime: 42,
};

/**
 * Format watch time into consistent display string (e.g. "25s (~0.4x)" or "42s (0.7x)")
 */
export function formatWatchTime(customWatchTime?: number | null, fallbackRatio: number = 0.7): string {
  if (typeof customWatchTime === 'number' && customWatchTime > 0) {
    const sec = Math.round(customWatchTime);
    return `${sec}s (~${(sec / 60).toFixed(1)}x)`;
  }
  const defaultSec = Math.round(fallbackRatio * 60);
  return `${defaultSec}s (${fallbackRatio}x)`;
}

/**
 * Calculates deterministic exact integer quantities based on base views and percentage ratios.
 * Supports per-order customWatchTime in seconds based on individual video length.
 * 
 * @param baseViews - The base view count (e.g., 100,000)
 * @param percentages - Object containing percentage ratios for each metric
 * @param customWatchTimeOverride - Optional explicit per-order watch time in seconds (e.g. 25)
 * @returns Object with exact integer counts for each metric and summary statistics
 */
export function calculateQuantities(
  baseViews: number,
  percentages: Partial<MetricPercentages> = {},
  customWatchTimeOverride?: number
): CalculatedQuantities {
  const safeViews = Math.max(0, Math.floor(Number.isFinite(baseViews) ? baseViews : 0));

  const safePercent = (val: number | undefined, defaultVal: number): number => {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      return defaultVal;
    }
    return val;
  };

  const likesPct = safePercent(percentages.likesPercentage, DEFAULT_PERCENTAGES.likesPercentage);
  const savesPct = safePercent(percentages.savesPercentage, DEFAULT_PERCENTAGES.savesPercentage);
  const sharesPct = safePercent(percentages.sharesPercentage, DEFAULT_PERCENTAGES.sharesPercentage);
  const repostsPct = safePercent(percentages.repostsPercentage, DEFAULT_PERCENTAGES.repostsPercentage);
  const commentsPct = safePercent(percentages.commentsPercentage, DEFAULT_PERCENTAGES.commentsPercentage);
  const followsPct = safePercent(percentages.followsPercentage, DEFAULT_PERCENTAGES.followsPercentage);
  const viewersPct = safePercent(percentages.viewersPercentage, DEFAULT_PERCENTAGES.viewersPercentage ?? 67.5);
  const watchRatio = safePercent(percentages.avgWatchTimeRatio, DEFAULT_PERCENTAGES.avgWatchTimeRatio ?? 0.7);

  // Exact rounded integer counts
  const likes = Math.round(safeViews * (likesPct / 100));
  const saves = Math.round(safeViews * (savesPct / 100));
  const shares = Math.round(safeViews * (sharesPct / 100));
  const reposts = Math.round(safeViews * (repostsPct / 100));
  const comments = Math.round(safeViews * (commentsPct / 100));
  const followers = Math.round(safeViews * (followsPct / 100));
  
  // Exact 67.5% Unique Viewers / Reach
  const viewers = Math.round(safeViews * (viewersPct / 100));

  // Determine watch time: Per-Order customWatchTime overrides global defaults
  const customWatch = (typeof customWatchTimeOverride === 'number' && customWatchTimeOverride > 0)
    ? customWatchTimeOverride
    : (typeof percentages.customWatchTime === 'number' && percentages.customWatchTime > 0)
    ? percentages.customWatchTime
    : undefined;

  const avgWatchTimeSeconds = customWatch !== undefined 
    ? Math.round(customWatch) 
    : Math.round(watchRatio * 60);

  const effectiveWatchRatio = customWatch !== undefined
    ? Number((customWatch / 60).toFixed(2))
    : watchRatio;

  const totalWatchTimeMinutes = Math.round(safeViews * (avgWatchTimeSeconds / 60));
  const watchTimeString = formatWatchTime(customWatch, effectiveWatchRatio);

  const totalEngagement = likes + saves + shares + reposts + comments;
  const engagementRate = safeViews > 0 
    ? Number(((totalEngagement / safeViews) * 100).toFixed(2)) 
    : 0;

  return {
    views: safeViews,
    likes,
    saves,
    shares,
    reposts,
    comments,
    followers,
    follows: followers,
    viewers,
    watchTimeRatio: effectiveWatchRatio,
    avgWatchTimeSeconds,
    totalWatchTimeMinutes,
    viewersPercentage: viewersPct,
    totalEngagement,
    engagementRate,
    customWatchTime: customWatch,
    watchTimeString,
  };
}

export const calculateOrderQuantities = calculateQuantities;
export default calculateQuantities;
