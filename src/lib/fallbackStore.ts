import { calculateReelMetrics, ReelMetricsResult } from './metricsEngine';

// BLACKLISTED (permanently banned - stuck/broken): 19741, 12897, 14366, 14749, 14750, 9685, 18803
// Verified working: #11610 Views, #7465 Viewers/Reach, #19262 Likes, #14548 Saves, #16949 Comments, #19608 Shares, #14549 Reposts, #17065 Followers
export const DEFAULT_SERVICE_MAPPINGS = [
  { metricType: 'VIEWS',     serviceId: '11610', costPer1000: 0.0016, minQuantity: 100 }, // 1-Hour Optimal High-Retention Views
  { metricType: 'VIEWERS',   serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Unique reach / impressions
  { metricType: 'REACH',     serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Unique reach alias
  { metricType: 'LIKES',     serviceId: '19262', costPer1000: 0.0324, minQuantity: 100 }, // Enforced min 100
  { metricType: 'COMMENTS',  serviceId: '16949', costPer1000: 0.3794, minQuantity: 100 }, // Enforced min 100
  { metricType: 'SAVES',     serviceId: '14548', costPer1000: 0.0392, minQuantity: 100 }, // Enforced min 100
  { metricType: 'SHARES',    serviceId: '19608', costPer1000: 0.0010, minQuantity: 100 }, // Enforced min 100
  { metricType: 'REPOSTS',   serviceId: '14549', costPer1000: 0.2938, minQuantity: 100 }, // Enforced min 100
  { metricType: 'FOLLOWERS', serviceId: '17065', costPer1000: 0.2957, minQuantity: 100 }, // Enforced min 100
];

export interface CampaignRecord {
  id: string;
  reelUrl: string | null;
  collaborationText: string;
  videoDurationSeconds: number;
  views: number;
  viewers: number;
  avgWatchTimeSeconds: number;
  follows: number;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  saves: number;
  followersPercentage: number;
  nonFollowersPercentage: number;
  countriesJson: string;
  graphDataJson: string;
  serviceStatus: string;
  updatedAt: Date | string;
  createdAt: Date | string;
}

declare global {
  // eslint-disable-next-line no-var
  var __campaignFallbackStore: CampaignRecord | undefined;
}

export function getDefaultCampaignRecord(): CampaignRecord {
  const defaultViews = 100000;
  const defaultDuration = 60;
  const computed = calculateReelMetrics(defaultViews, defaultDuration);
  return {
    id: 'campaign-serverless-fallback',
    reelUrl: null,
    collaborationText: 'Collaboration with cinematic.edits.fx and songs_movies.byte',
    videoDurationSeconds: defaultDuration,
    views: defaultViews,
    viewers: computed.viewers,
    avgWatchTimeSeconds: computed.avgWatchTimeSeconds,
    follows: computed.follows,
    likes: 1500,
    comments: 0,
    reposts: 15,
    shares: 49,
    saves: 144,
    followersPercentage: computed.followersPercentage,
    nonFollowersPercentage: computed.nonFollowersPercentage,
    countriesJson: computed.countriesJson,
    graphDataJson: computed.graphDataJson,
    serviceStatus: 'IDLE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getFallbackCampaign(): CampaignRecord {
  if (!globalThis.__campaignFallbackStore) {
    globalThis.__campaignFallbackStore = getDefaultCampaignRecord();
  }
  return globalThis.__campaignFallbackStore;
}

export function updateFallbackCampaign(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
): { data: CampaignRecord; computed: ReelMetricsResult } {
  const current = getFallbackCampaign();
  const views = typeof body.views === 'number' ? Math.max(0, body.views) : current.views;
  const videoDurationSeconds =
    typeof body.videoDurationSeconds === 'number'
      ? Math.max(1, body.videoDurationSeconds)
      : current.videoDurationSeconds;

  const countryLabelFormat = body.countryLabelFormat === 'United States' ? 'United States' : 'USA';
  const computed = calculateReelMetrics(views, videoDurationSeconds, undefined, countryLabelFormat);

  const updated: CampaignRecord = {
    ...current,
    id: current.id || 'campaign-serverless-fallback',
    reelUrl: body.reelUrl !== undefined ? body.reelUrl : current.reelUrl,
    collaborationText:
      body.collaborationText !== undefined ? String(body.collaborationText) : current.collaborationText,
    videoDurationSeconds,
    views,
    viewers: computed.viewers,
    avgWatchTimeSeconds: computed.avgWatchTimeSeconds,
    follows: computed.follows,
    likes: typeof body.likes === 'number' ? body.likes : current.likes,
    comments: typeof body.comments === 'number' ? body.comments : current.comments,
    reposts: typeof body.reposts === 'number' ? body.reposts : current.reposts,
    shares: typeof body.shares === 'number' ? body.shares : current.shares,
    saves: typeof body.saves === 'number' ? body.saves : current.saves,
    followersPercentage: computed.followersPercentage,
    nonFollowersPercentage: computed.nonFollowersPercentage,
    countriesJson: computed.countriesJson,
    graphDataJson: computed.graphDataJson,
    serviceStatus: body.serviceStatus ? String(body.serviceStatus) : current.serviceStatus,
    updatedAt: new Date(),
  };

  globalThis.__campaignFallbackStore = updated;
  return { data: updated, computed };
}
