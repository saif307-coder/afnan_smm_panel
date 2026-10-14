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
  viewers?: number;
  totalEngagement: number;
  engagementRate: number; // percentage of views that engaged
}

export const DEFAULT_PERCENTAGES: MetricPercentages = {
  likesPercentage: 3.4,
  savesPercentage: 2.8,
  sharesPercentage: 0.95,
  repostsPercentage: 0.35,
  commentsPercentage: 0.12,
  followsPercentage: 0.025,
  viewersPercentage: 67.5,
};

/**
 * Calculates deterministic exact integer quantities based on base views and percentage ratios.
 * 
 * @param baseViews - The base view count (e.g., 100,000)
 * @param percentages - Object containing percentage ratios for each metric
 * @returns Object with exact integer counts for each metric and summary statistics
 */
export function calculateQuantities(
  baseViews: number,
  percentages: Partial<MetricPercentages> = {}
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

  // Exact rounded integer counts
  const likes = Math.round(safeViews * (likesPct / 100));
  const saves = Math.round(safeViews * (savesPct / 100));
  const shares = Math.round(safeViews * (sharesPct / 100));
  const reposts = Math.round(safeViews * (repostsPct / 100));
  const comments = Math.round(safeViews * (commentsPct / 100));
  const followers = Math.round(safeViews * (followsPct / 100));
  const viewers = Math.round(safeViews * (viewersPct / 100));

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
    totalEngagement,
    engagementRate,
  };
}

export const calculateOrderQuantities = calculateQuantities;
export default calculateQuantities;
