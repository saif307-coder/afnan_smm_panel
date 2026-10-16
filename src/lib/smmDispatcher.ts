/**
 * SMM Provider Dispatcher Service (Phase 4 & Auto-Healing)
 * 
 * Handles bundle splitting, external SMM API communication, error handling,
 * sanitization of service IDs, auto-healing fallback for invalid service IDs,
 * and order state reconciliation with Prisma.
 */

import { prisma } from '@/lib/prisma';
import { ensureOfficialProvider } from '../../prisma/seedProvider';
import { aggregateParentOrderStatus } from '@/utils/orderDeliveryProgress';

// ─── Permanently Blacklisted Provider Service IDs ──────────────────────────
// Banned: 19741, 12897, 14366, 14749, 14750, 9685, 18803 (stuck/broken/bot-raw/wrong platform)
// Verified working: #11610 Views, #7465 Viewers/Reach, #19262 Likes, #14548 Saves, #16949 Comments, #19608 Shares, #14549 Reposts, #17065 Followers
export const DEFAULT_DISPATCHER_MAPPINGS: Record<string, { serviceId: string; costPer1000: number; minQuantity: number }> = {
  VIEWS:     { serviceId: '11610', costPer1000: 0.0016, minQuantity: 100 }, // 1-Hour Optimal High-Retention Views (Watch Hours, Impressions, Reach, Instant)
  VIEWERS:   { serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Unique reach / impressions
  REACH:     { serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Unique reach alias
  LIKES:     { serviceId: '19262', costPer1000: 0.0324, minQuantity: 10  }, // Low-min (1-10) verified working
  COMMENTS:  { serviceId: '16949', costPer1000: 0.3794, minQuantity: 10  }, // Low-min (10) verified working Custom Comments
  SAVES:     { serviceId: '14548', costPer1000: 0.0392, minQuantity: 10  }, // Low-min (1-10) verified working
  SHARES:    { serviceId: '19608', costPer1000: 0.0010, minQuantity: 10  }, // Low-min (10) verified working
  REPOSTS:   { serviceId: '14549', costPer1000: 0.2938, minQuantity: 1   }, // Low-min (1) verified working
  FOLLOWERS: { serviceId: '17065', costPer1000: 0.2957, minQuantity: 10  }, // Low-min (10) verified working
};

export interface DispatchItemResult {
  metricType: string;
  serviceId?: string;
  quantity: number;
  cost: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  providerOrderId?: string | number;
  error?: string;
  rawResponse?: unknown;
}

export interface DispatchSummary {
  orderId: string;
  overallStatus: 'COMPLETED' | 'PROCESSING' | 'PARTIAL' | 'FAILED' | 'CANCELED' | 'PENDING';
  totalCost: number;
  successfulItems: number;
  failedItems: number;
  items: DispatchItemResult[];
  providerId: string;
  providerName: string;
}

interface SmmApiResponse {
  order?: number | string;
  error?: string;
  status?: string | number;
  [key: string]: unknown;
}

export interface ProviderServiceItem {
  service: number | string;
  name: string;
  type?: string;
  category?: string;
  rate: string | number;
  min: number | string;
  max: number | string;
}

// In-memory cache for provider service list to prevent multiple network roundtrips during bundle dispatch
let cachedProviderServices: {
  providerId: string;
  fetchedAt: number;
  services: ProviderServiceItem[];
} | null = null;

/**
 * Fetches the complete live services catalog from the active provider API.
 */
export async function fetchLiveProviderServices(
  apiUrl: string,
  apiKey: string,
  providerId: string,
  forceRefresh = false
): Promise<ProviderServiceItem[]> {
  const now = Date.now();
  if (!forceRefresh && cachedProviderServices && cachedProviderServices.providerId === providerId && now - cachedProviderServices.fetchedAt < 60000) {
    return cachedProviderServices.services;
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        key: apiKey,
        action: 'services',
      }).toString(),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (Array.isArray(data)) {
      cachedProviderServices = {
        providerId,
        fetchedAt: now,
        services: data as ProviderServiceItem[],
      };
      return data as ProviderServiceItem[];
    }
  } catch (err) {
    console.error('[SMM Dispatcher] Failed to query live services from provider:', err);
  }

  return [];
}

/**
 * Normalizes an Instagram link by ensuring a harmless unique tracking parameter (?igshid=...)
 * is attached so duplicate active-link locks on the same Reel URL do not block dispatch.
 */
export function normalizeLinkWithTrackingParam(link: string): string {
  try {
    const url = new URL(link);
    const uniqueVal = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    url.searchParams.set('igshid', uniqueVal);
    return url.toString();
  } catch {
    const sep = link.includes('?') ? '&' : '?';
    return `${link}${sep}igshid=${Date.now().toString(36)}`;
  }
}

/**
 * Generates an array of realistic Instagram comments matching exact requested quantity.
 * Guarantees exactly `quantity` non-empty lines for custom comments services.
 */
export function generateRealisticCommentsPayload(quantity: number): string {
  const templates = [
    'Amazing content! 🔥',
    'Love this! 💯',
    'So good! Keep it up! 👏',
    'Wow amazing! ❤️',
    'This is great! 🙌',
    'Incredible work! 🌟',
    'Really impressive! 💪',
    'Absolutely love it! 😍',
    'Top quality content! 🎯',
    'Keep going! You are the best! 🏆',
    'Brilliant video! ✨',
    'Super creative! 🚀',
    'Fantastic execution! 👌',
    'Awesome vibe! 🎉',
    'Obsessed with this! 💖',
    'Outstanding production! 🎬',
    'Pure perfection! 💎',
    'Such high quality! ⚡',
    'Inspiring work! 🌈',
    'Truly magnificent! 👑',
    'Major inspiration! ✨',
    'Best reel today! 🔥',
    'Can’t stop watching this! 👏',
    'The aesthetics are unreal! 🌟',
    'Great job on this! 💯',
    'Level of detail is insane! 🙌',
    'Never seen anything this good! ❤️',
    'Next level content! 🚀',
    'Saved this immediately! 📌',
    'Masterpiece right here! 💎',
    'Totally killed it! 🔥',
    'Unbelievable quality! 👏',
    'Always delivering the best! 🏆',
    'This deserves millions of views! 🌟',
    'On repeat all day! 🎧',
    'Pure art! 🎨',
    'So satisfying to watch! 😍',
    'Superb presentation! 👏',
    'Always inspiring! 💡',
    'Very well done! 💯',
    'This is next tier! 🚀',
    'Phenomenal work! 🌟',
    'Love the dedication! 💪',
    'Iconic moments! ✨',
    'Golden standard right here! 🏆',
    'Couldn’t agree more! 🙌',
    'So aesthetic and clean! 💫',
    'Big respect for this! 👑',
    'Fire edit as always! 🔥',
    'Can’t wait for more! 🚀',
  ];

  const lines: string[] = [];
  const targetCount = Math.max(1, quantity);
  for (let i = 0; i < targetCount; i++) {
    lines.push(templates[i % templates.length]);
  }
  return lines.join('\n');
}

/**
 * Strict Instagram platform guard:
 * 1. Combined text `${service.category} ${service.name}` MUST match /instagram|\big\b/i
 * 2. Combined text MUST NOT match /telegram|tiktok|youtube|facebook|twitter|x\.com|kick|threads|twitch|spotify|discord|linkedin|snapchat|pinterest/i
 */
export function isInstagramService(service: { name?: string; category?: string }): boolean {
  const text = `${service.category || ''} ${service.name || ''}`;
  if (!/instagram|\big\b/i.test(text)) return false;

  const nonIgBlacklist = /telegram|tiktok|youtube|facebook|twitter|x\.com|kick|threads|twitch|spotify|discord|linkedin|snapchat|pinterest/i;
  if (nonIgBlacklist.test(text)) return false;

  return true;
}

/**
 * Computes speed score for an Instagram service item based on keywords.
 * Prioritizes delivery speed and fast startup, while penalizing slow queues.
 * +100 points: Instant / Super Fast / Ultra Fast / Fast
 * +60 points: High daily speed (100k, 200k, 500k, 1m/day, 50k-200k)
 * +40 points: Fast start time (0-1 min, 0-5 min, 0-15 min, 0-30 min)
 * -100 points: Slow queues, drop, maintenance
 */
export function calculateSpeedScore(service: { name?: string; category?: string }): number {
  const name = service.name || '';
  const category = service.category || '';
  const text = `${category} ${name}`;

  let score = 0;

  // +100 points if name/category contains instant, super fast, ultra fast, fast
  if (/instant|super fast|ultra fast|\bfast\b/i.test(text)) {
    score += 100;
  }

  // +60 points if name contains high daily speed
  if (/100k|200k|500k|1m\/day|1m|50k-200k|50k-500k|500k-1m|500k-2m|10k-100k/i.test(name)) {
    score += 60;
  }

  // +40 points if start time in name is fast
  if (/0-1 min|0-5 min|0-15 min|0-30 min|0-1hrs|0-1 hrs/i.test(name)) {
    score += 40;
  }

  // -100 points (penalize) if name contains slow queues or maintenance
  if (/slow|1-24|24-48|\bdrop\b|under maintenance|no cancel/i.test(name)) {
    score -= 100;
  }

  return score;
}

/**
 * Permanently blacklisted service IDs — stuck, broken, or raw-counter bots.
 * Banned from ALL dispatch paths (Views, Viewers, Likes, Saves, Comments).
 */
export const BLACKLISTED_VIEW_SERVICES = new Set([
  '19741', '12897', '14366', '14749', '14750', '9685', '18803',
]);

/**
 * High-Retention & Quality Scorer for Instagram Views.
 * Prioritizes Watch Time, High-Retention, Unique Reach, Impressions, and Lifetime/Non-Drop.
 * Completely eliminates raw-counter bot services.
 */
export function calculateViewsQualityScore(service: { service?: string | number; name?: string; category?: string }): number {
  const cleanId = String(service.service || '').replace(/[^0-9]/g, '').trim();
  if (BLACKLISTED_VIEW_SERVICES.has(cleanId)) {
    return -999999;
  }

  const name = (service.name || '').toLowerCase();
  const category = (service.category || '').toLowerCase();
  const text = `${category} ${name}`;

  let score = 0;

  // Major priority: Watch Time / Watch Hours (+250)
  if (/watch\s*time|watch\s*hours|\bhours\b/i.test(text)) {
    score += 250;
  }

  // High Retention (+200)
  if (/retention|high\s*retention/i.test(text)) {
    score += 200;
  }

  // Reach & Impressions (+180)
  if (/impressions?\s*\+\s*reach|reach|impressions?/i.test(text)) {
    score += 180;
  }

  // Real / Non-Drop / Organic / Explore / Ads / Lifetime (+150)
  if (/real|non[\s-]*drop|organic|explore|ads|lifetime/i.test(text)) {
    score += 150;
  }

  // Video / Reels (+100)
  if (/reels?|video/i.test(text)) {
    score += 100;
  }

  // Instant / Fast start (+50)
  if (/instant/i.test(text)) {
    score += 50;
  }

  // Heavily penalize raw counter bots or cheap bot queues (-300)
  if (/cheap|slow\b|raw/i.test(name)) {
    score -= 300;
  }

  return score;
}

/**
 * Dynamically resolves candidate active, working Instagram services for a metric,
 * ranked by Quality & Retention for Views, and Delivery Speed for engagement metrics.
 */
export function matchCandidateActiveServices(
  services: ProviderServiceItem[],
  metricType: string,
  excludeIds: string[] = []
): ProviderServiceItem[] {
  const normMetric = metricType.toUpperCase();
  const excludeSet = new Set(excludeIds.map((id) => String(id).replace(/[^0-9]/g, '').trim()));

  // 1. Strict Instagram Platform Guard
  const igServices = services.filter((s) => {
    const cleanId = String(s.service).replace(/[^0-9]/g, '').trim();
    if (excludeSet.has(cleanId)) return false;
    return isInstagramService(s);
  });

  const filterByNameKeywords = (
    nameKeywords: string[],
    exclude: string[] = [],
    maxRate = 1.50,
    maxMinQty = 10
  ) => {
    return igServices
      .filter((s) => {
        // Hard blacklist guard: reject permanently banned service IDs on ALL metrics
        const cleanId = String(s.service).replace(/[^0-9]/g, '').trim();
        if (BLACKLISTED_VIEW_SERVICES.has(cleanId)) return false;

        const name = (s.name || '').toLowerCase();
        const matches = nameKeywords.some((k) => name.includes(k.toLowerCase()));
        if (!matches) return false;
        const isExcluded = exclude.some((e) => name.includes(e.toLowerCase()));
        if (isExcluded) return false;
        const rate = parseFloat(String(s.rate)) || 0;
        if (rate > maxRate) return false;
        const min = parseInt(String(s.min || 0), 10) || 0;
        if (min > maxMinQty) return false;
        return true;
      })
      .sort((a, b) => {
        // Priority 1: Delivery Speed Score (Highest first)
        const scoreA = calculateSpeedScore(a);
        const scoreB = calculateSpeedScore(b);
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        // Priority 2: Smallest min quantity
        const minA = parseInt(String(a.min || 0), 10) || 0;
        const minB = parseInt(String(b.min || 0), 10) || 0;
        const lowA = minA <= maxMinQty ? 0 : 1;
        const lowB = minB <= maxMinQty ? 0 : 1;
        if (lowA !== lowB) return lowA - lowB;

        // Priority 3: Lowest cost
        const rateA = parseFloat(String(a.rate)) || 0;
        const rateB = parseFloat(String(b.rate)) || 0;
        return rateA - rateB;
      });
  };

  switch (normMetric) {
    case 'VIEWS': {
      return igServices
        .filter((s) => {
          const cleanId = String(s.service).replace(/[^0-9]/g, '').trim();
          if (BLACKLISTED_VIEW_SERVICES.has(cleanId)) return false;

          const name = (s.name || '').toLowerCase();
          const category = (s.category || '').toLowerCase();

          // Specifically require /instagram/i AND /view|reel/i
          const hasViews = /views|view|reel/i.test(name) || (/views|view|reel/i.test(category) && /video|reel|all/i.test(name));
          if (!hasViews) return false;

          // Exclude story / live stream / igtv unless explicitly reel / video / post views
          const isStoryOrLive = /story|live stream|igtv/i.test(name) && !/reel|video|post/i.test(name);
          if (isStoryOrLive) return false;

          const isOtherMetric = /like|save|comment|auto\b/i.test(name);
          if (isOtherMetric) return false;

          const rate = parseFloat(String(s.rate)) || 0;
          if (rate > 2.00) return false;

          const min = parseInt(String(s.min || 0), 10) || 0;
          if (min > 100) return false;

          return true;
        })
        .sort((a, b) => {
          // Priority 1: Retention & Quality Score (Watch Time / Real / Impressions / Reach)
          const scoreA = calculateViewsQualityScore(a);
          const scoreB = calculateViewsQualityScore(b);
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }

          // Priority 2: Min Qty
          const minA = parseInt(String(a.min || 0), 10) || 0;
          const minB = parseInt(String(b.min || 0), 10) || 0;
          if (minA !== minB) return minA - minB;

          // Priority 3: Rate
          const rateA = parseFloat(String(a.rate)) || 0;
          const rateB = parseFloat(String(b.rate)) || 0;
          return rateA - rateB;
        });
    }
    case 'VIEWERS':
    case 'REACH': {
      return igServices
        .filter((s) => {
          const cleanId = String(s.service).replace(/[^0-9]/g, '').trim();
          if (BLACKLISTED_VIEW_SERVICES.has(cleanId)) return false;

          const name = (s.name || '').toLowerCase();
          const category = (s.category || '').toLowerCase();
          const text = `${category} ${name}`;

          const hasReach = /reach|impression|unique/i.test(text);
          if (!hasReach) return false;

          const isOther = /story views \||twitter|tiktok|auto\b|comment|save \[/i.test(name);
          if (isOther) return false;

          const rate = parseFloat(String(s.rate)) || 0;
          if (rate > 2.0) return false;

          return true;
        })
        .sort((a, b) => {
          // Priority 1: Real / Reach quality
          const isRealA = /real|reach/i.test(a.name) ? 1 : 0;
          const isRealB = /real|reach/i.test(b.name) ? 1 : 0;
          if (isRealA !== isRealB) return isRealB - isRealA;

          // Priority 2: Min Qty (allows small orders)
          const minA = parseInt(String(a.min || 0), 10) || 0;
          const minB = parseInt(String(b.min || 0), 10) || 0;
          if (minA !== minB) return minA - minB;

          // Priority 3: Rate
          const rateA = parseFloat(String(a.rate)) || 0;
          const rateB = parseFloat(String(b.rate)) || 0;
          return rateA - rateB;
        });
    }
    case 'LIKES':
      return filterByNameKeywords(['likes', 'like'], ['comment', 'story', 'live', 'auto', 'view', 'save'], 1.50, 10);
    case 'COMMENTS':
      return filterByNameKeywords(['comments', 'comment'], ['like', 'story', 'auto', 'custom', 'verified', 'blue tick', 'indian'], 1.50, 10);
    case 'SAVES':
      return filterByNameKeywords(['saves', 'save'], ['story', 'auto', 'view', 'like'], 1.50, 10);
    case 'SHARES':
      return filterByNameKeywords(['shares', 'share'], ['story', 'auto', 'facebook', 'tiktok'], 1.50, 10);
    case 'REPOSTS': {
      const reposts = filterByNameKeywords(['repost', 'reposts'], ['story', 'auto', 'tiktok', 'twitter'], 1.50, 10);
      return reposts.length > 0 ? reposts : filterByNameKeywords(['shares', 'share'], ['story', 'auto', 'facebook', 'tiktok'], 1.50, 10);
    }
    case 'FOLLOWERS':
    case 'FOLLOWS':
      return filterByNameKeywords(['followers', 'follower'], ['story', 'auto'], 1.50, 10);
    default:
      return [];
  }
}

/**
 * Dynamically resolves the best active, cheapest Instagram service for a metric.
 */
export function matchBestActiveService(
  services: ProviderServiceItem[],
  metricType: string
): ProviderServiceItem | null {
  const candidates = matchCandidateActiveServices(services, metricType);
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Smart Active-Link Failover routine:
 * Triggered when provider responds with:
 * "You have active order with this link. Please wait until order being completed."
 * 
 * 1. Queries live service catalog and tries up to 3 alternate low-cost services for the same metric.
 * 2. If all alternate services also report active order lock, normalizes link with a unique tracking query param (?igshid=...) and retries.
 */
export async function handleActiveLinkFailoverAndRetry(
  provider: { id: string; apiUrl: string; apiKey: string },
  item: { metricType: string; quantity: number },
  targetLink: string,
  blockedServiceId: string
): Promise<{
  success: boolean;
  orderId?: string | number;
  cost?: number;
  serviceId?: string;
  error?: string;
  rawResponse?: unknown;
  usedLink?: string;
}> {
  const cleanBlockedId = String(blockedServiceId).replace(/[^0-9]/g, '').trim();
  console.warn(
    `[SMM Dispatcher Active-Link Failover] Active order lock detected on Svc #${cleanBlockedId} for ${item.metricType} on link "${targetLink}". Initiating failover...`
  );

  const services = await fetchLiveProviderServices(provider.apiUrl, provider.apiKey, provider.id, false);
  const alternateCandidates = matchCandidateActiveServices(services, item.metricType, [cleanBlockedId]).slice(0, 3);

  // Strategy 1: Sequentially retry with alternate candidate services on the target link
  for (const alt of alternateCandidates) {
    const cleanAltId = String(alt.service).replace(/[^0-9]/g, '').trim();
    const altMin = parseInt(String(alt.min || 0), 10) || 0;
    const altRate = parseFloat(String(alt.rate || 0)) || 0;

    if (altMin > 0 && item.quantity < altMin) {
      console.log(`[SMM Dispatcher Active-Link Failover] Candidate #${cleanAltId} min (${altMin}) > qty (${item.quantity}). Skipping candidate.`);
      continue;
    }

    const estimatedCost = (item.quantity / 1000) * altRate;
    console.log(`[SMM Dispatcher Active-Link Failover] Retrying ${item.metricType} with alternate service #${cleanAltId} ("${alt.name}")...`);

    try {
      const altBaseParams: Record<string, string> = {
        key: provider.apiKey,
        action: 'add',
        service: cleanAltId,
        link: targetLink,
        quantity: item.quantity.toString(),
      };
      if (item.metricType === 'COMMENTS' && item.quantity > 0) {
        altBaseParams.comments = generateRealisticCommentsPayload(item.quantity);
      }
      const params = new URLSearchParams(altBaseParams);

      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      let json: SmmApiResponse = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: `Invalid JSON response: ${text.slice(0, 100)}` };
      }

      if (json.order !== undefined && json.order !== null) {
        console.log(
          `[SMM Dispatcher Active-Link Failover] SUCCESS! Alternate service #${cleanAltId} accepted order #${json.order}!`
        );

        // Update database mapping to working service
        try {
          await prisma.serviceMapping.upsert({
            where: {
              providerId_metricType: {
                providerId: provider.id,
                metricType: item.metricType.toUpperCase(),
              },
            },
            update: {
              serviceId: cleanAltId,
              costPer1000: altRate,
              minQuantity: altMin,
              isActive: true,
            },
            create: {
              providerId: provider.id,
              metricType: item.metricType.toUpperCase(),
              serviceId: cleanAltId,
              costPer1000: altRate,
              minQuantity: altMin,
              isActive: true,
            },
          });
        } catch {
          // non-critical
        }

        return {
          success: true,
          orderId: json.order,
          cost: estimatedCost,
          serviceId: cleanAltId,
          rawResponse: json,
          usedLink: targetLink,
        };
      }

      const errorMsg = String(json.error || '');
      if (/active order with this link|wait until order being completed/i.test(errorMsg)) {
        console.warn(`[SMM Dispatcher Active-Link Failover] Alternate service #${cleanAltId} also locked on exact link.`);
      } else {
        console.warn(`[SMM Dispatcher Active-Link Failover] Alternate service #${cleanAltId} returned: ${errorMsg}`);
      }
    } catch (err) {
      console.error(`[SMM Dispatcher Active-Link Failover] Error dispatching alternate service #${cleanAltId}:`, err);
    }
  }

  // Strategy 2: Append or normalize unique tracking query param (?igshid=...)
  const normalizedLink = normalizeLinkWithTrackingParam(targetLink);
  console.log(`[SMM Dispatcher Active-Link Failover] Strategy 2: Retrying with normalized unique link "${normalizedLink}"...`);

  const servicesToTry: string[] = [];
  const blockedObj = services.find((s) => String(s.service).replace(/[^0-9]/g, '').trim() === cleanBlockedId);
  if (blockedObj && isInstagramService(blockedObj)) {
    servicesToTry.push(cleanBlockedId);
  }
  for (const alt of alternateCandidates) {
    const id = String(alt.service).replace(/[^0-9]/g, '').trim();
    if (id && !servicesToTry.includes(id) && isInstagramService(alt)) {
      servicesToTry.push(id);
    }
  }

  for (const svcId of servicesToTry) {
    if (!svcId) continue;
    try {
      const params = new URLSearchParams({
        key: provider.apiKey,
        action: 'add',
        service: svcId,
        link: normalizedLink,
        quantity: item.quantity.toString(),
      });

      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      let json: SmmApiResponse = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: `Invalid JSON response: ${text.slice(0, 100)}` };
      }

      if (json.order !== undefined && json.order !== null) {
        console.log(
          `[SMM Dispatcher Active-Link Failover] SUCCESS with normalized link on service #${svcId}! Order #${json.order}!`
        );

        const matched = services.find((s) => String(s.service).replace(/[^0-9]/g, '').trim() === svcId);
        const rate = matched ? parseFloat(String(matched.rate)) || 0 : 0;
        const cost = (item.quantity / 1000) * rate;

        return {
          success: true,
          orderId: json.order,
          cost,
          serviceId: svcId,
          rawResponse: json,
          usedLink: normalizedLink,
        };
      }
    } catch (err) {
      console.error(`[SMM Dispatcher Active-Link Failover] Error with normalized link on service #${svcId}:`, err);
    }
  }

  return {
    success: false,
    serviceId: cleanBlockedId,
    error: 'All alternate services and unique link normalization reported active link lock on provider',
  };
}

/**
 * Auto-healing routine: dynamically queries the provider, matches an active service,
 * updates Prisma ServiceMapping in the database, and immediately executes dispatch.
 */
export async function autoHealAndRetryService(
  provider: { id: string; apiUrl: string; apiKey: string },
  item: { metricType: string; quantity: number },
  targetLink: string
): Promise<{
  success: boolean;
  healedMapping?: { serviceId: string; costPer1000: number; minQuantity: number };
  orderId?: string | number;
  cost?: number;
  error?: string;
  rawResponse?: unknown;
}> {
  console.warn(`[SMM Dispatcher Auto-Heal] Auto-healing invalid service ID for metric "${item.metricType}"...`);
  
  const services = await fetchLiveProviderServices(provider.apiUrl, provider.apiKey, provider.id, true);
  if (!services || services.length === 0) {
    return { success: false, error: 'Could not fetch live services from provider for auto-healing' };
  }

  const matched = matchBestActiveService(services, item.metricType);
  if (!matched || !isInstagramService(matched)) {
    return { success: false, error: `No active replacement Instagram service found for metric "${item.metricType}"` };
  }

  const cleanNewServiceId = String(matched.service).replace(/[^0-9]/g, '').trim();
  const newRate = parseFloat(String(matched.rate)) || 0;
  const newMin = parseInt(String(matched.min)) || 0;

  // Persist healed service mapping to Prisma DB
  try {
    await prisma.serviceMapping.upsert({
      where: {
        providerId_metricType: {
          providerId: provider.id,
          metricType: item.metricType.toUpperCase(),
        },
      },
      update: {
        serviceId: cleanNewServiceId,
        costPer1000: newRate,
        minQuantity: newMin,
        isActive: true,
      },
      create: {
        providerId: provider.id,
        metricType: item.metricType.toUpperCase(),
        serviceId: cleanNewServiceId,
        costPer1000: newRate,
        minQuantity: newMin,
        isActive: true,
      },
    });
    console.log(`[SMM Dispatcher Auto-Heal] Updated DB ServiceMapping: ${item.metricType} -> Service #${cleanNewServiceId} ($${newRate}/1k, min: ${newMin})`);
  } catch (dbErr) {
    console.error(`[SMM Dispatcher Auto-Heal] Failed to persist healed mapping in DB:`, dbErr);
  }

  const healedMapping = { serviceId: cleanNewServiceId, costPer1000: newRate, minQuantity: newMin };

  if (newMin > 0 && item.quantity < newMin) {
    return {
      success: false,
      healedMapping,
      error: `Skipped: Qty (${item.quantity}) below provider min (${newMin})`,
    };
  }

  const estimatedCost = (item.quantity / 1000) * newRate;

  // Immediately retry dispatching with sanitized Service ID
  try {
    const healBaseParams: Record<string, string> = {
      key: provider.apiKey,
      action: 'add',
      service: String(Number(cleanNewServiceId) || cleanNewServiceId),
      link: targetLink,
      quantity: item.quantity.toString(),
    };
    if (item.metricType === 'COMMENTS' && item.quantity > 0) {
      healBaseParams.comments = generateRealisticCommentsPayload(item.quantity);
    }
    const params = new URLSearchParams(healBaseParams);

    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const text = await response.text();
    let json: SmmApiResponse = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: `Invalid provider JSON: ${text.slice(0, 100)}` };
    }

    if (json.order !== undefined && json.order !== null) {
      console.log(`[SMM Dispatcher Auto-Heal] Successfully dispatched ${item.metricType} with new Service #${cleanNewServiceId}! Order #${json.order}`);
      return {
        success: true,
        healedMapping,
        orderId: json.order,
        cost: estimatedCost,
        rawResponse: json,
      };
    } else {
      const errorMsg = String(json.error || 'Retry rejected by provider');
      if (/active order with this link|wait until order being completed/i.test(errorMsg)) {
        console.warn(`[SMM Dispatcher Auto-Heal] Active link lock encountered during auto-heal for ${item.metricType}. Triggering failover...`);
        const failover = await handleActiveLinkFailoverAndRetry(provider, item, targetLink, cleanNewServiceId);
        if (failover.success && failover.orderId) {
          return {
            success: true,
            healedMapping: failover.serviceId
              ? { serviceId: failover.serviceId, costPer1000: failover.cost ? (failover.cost * 1000) / item.quantity : newRate, minQuantity: newMin }
              : healedMapping,
            orderId: failover.orderId,
            cost: failover.cost || estimatedCost,
            rawResponse: failover.rawResponse,
          };
        }
      }
      return {
        success: false,
        healedMapping,
        error: errorMsg,
        rawResponse: json,
      };
    }
  } catch (retryErr) {
    return {
      success: false,
      healedMapping,
      error: retryErr instanceof Error ? retryErr.message : String(retryErr),
    };
  }
}

/**
 * Dispatches an order to the active SMM Provider.
 * Automatically splits the bundle into individual service orders.
 */
export async function dispatchBundledOrder(orderId: string): Promise<DispatchSummary> {
  // 1. Fetch Order from DB
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Order with ID ${orderId} not found`);
  }

  // 2. Fetch Active Provider with Service Mappings
  let provider = await prisma.smmProvider.findFirst({
    where: { isActive: true },
    include: { mappings: { where: { isActive: true } } },
  });

  // Self-healing fallback if no provider is seeded
  if (!provider) {
    console.warn('No active SMM provider found. Auto-initializing official provider...');
    await ensureOfficialProvider();
    provider = await prisma.smmProvider.findFirst({
      where: { isActive: true },
      include: { mappings: { where: { isActive: true } } },
    });
  }

  if (!provider) {
    throw new Error('No active SMM Provider configured');
  }

  // Map metricType -> mapping (with sanitized numeric IDs)
  const mappingMap = new Map<string, { serviceId: string; costPer1000: number; minQuantity: number }>();
  for (const m of provider.mappings) {
    const cleanId = String(m.serviceId).replace(/[^0-9]/g, '').trim();
    mappingMap.set(m.metricType.toUpperCase(), {
      serviceId: cleanId,
      costPer1000: m.costPer1000,
      minQuantity: (m as { minQuantity?: number }).minQuantity ?? 0,
    });
  }

  // 3. Build bundle list from order quantities (Enforcing Watch Time & 67.5% Viewers on Every Order)
  const viewersQuantity = Math.round(order.baseViews * 0.675);
  const metricItems = [
    { metricType: 'VIEWS', quantity: order.baseViews },
    { metricType: 'VIEWERS', quantity: viewersQuantity },
    { metricType: 'LIKES', quantity: order.likes },
    { metricType: 'SAVES', quantity: order.saves },
    { metricType: 'SHARES', quantity: order.shares },
    { metricType: 'REPOSTS', quantity: order.reposts },
    { metricType: 'COMMENTS', quantity: order.comments },
    { metricType: 'FOLLOWERS', quantity: order.followers },
  ];

  const dispatchResults: DispatchItemResult[] = [];
  let totalSuccessfulCost = 0;
  let successCount = 0;
  let failureCount = 0;

  const targetLink = order.targetReelUrl || 'https://www.instagram.com/reel/session_default/';

  // 4. Iterate and dispatch each metric with quantity > 0
  for (const rawItem of metricItems) {
    // Use a mutable copy so min-quantity clamping can adjust the quantity without re-assigning the const
    let item = { ...rawItem };
    if (item.quantity <= 0) {
      continue;
    }

    let mapping =
      mappingMap.get(item.metricType) ||
      (item.metricType === 'FOLLOWERS' ? mappingMap.get('FOLLOWS') : undefined) ||
      (item.metricType === 'VIEWERS' ? mappingMap.get('REACH') : undefined);
    
    // Fallback to static defaults if not mapped
    if (!mapping && DEFAULT_DISPATCHER_MAPPINGS[item.metricType]) {
      mapping = DEFAULT_DISPATCHER_MAPPINGS[item.metricType];
    }

    let cleanServiceId = mapping ? String(mapping.serviceId).replace(/[^0-9]/g, '').trim() : '';

    // Hard blacklist guard: if mapped service is in permanent blacklist, replace with verified safe default
    if (cleanServiceId && BLACKLISTED_VIEW_SERVICES.has(cleanServiceId)) {
      console.warn(
        `[SMM Dispatcher] Service ID #${cleanServiceId} for ${item.metricType} is in the permanent blacklist. Falling back to default.`
      );
      if (DEFAULT_DISPATCHER_MAPPINGS[item.metricType]) {
        mapping = DEFAULT_DISPATCHER_MAPPINGS[item.metricType];
        cleanServiceId = String(mapping.serviceId).replace(/[^0-9]/g, '').trim();
      } else {
        cleanServiceId = '';
      }
    }

    // If no mapping exists yet or serviceId is blank, attempt auto-healing right away
    if (!mapping || !cleanServiceId) {
      const healed = await autoHealAndRetryService(provider, item, targetLink);
      if (healed.success && healed.orderId) {
        dispatchResults.push({
          metricType: item.metricType,
          serviceId: healed.healedMapping?.serviceId,
          quantity: item.quantity,
          cost: healed.cost || 0,
          status: 'SUCCESS',
          providerOrderId: healed.orderId,
          rawResponse: healed.rawResponse,
        });
        totalSuccessfulCost += healed.cost || 0;
        successCount++;
        continue;
      } else if (healed.error === 'Skipped (Below Min)') {
        dispatchResults.push({
          metricType: item.metricType,
          serviceId: healed.healedMapping?.serviceId,
          quantity: item.quantity,
          cost: 0,
          status: 'SKIPPED',
          error: 'Skipped (Below Min)',
        });
        continue;
      } else {
        dispatchResults.push({
          metricType: item.metricType,
          quantity: item.quantity,
          cost: 0,
          status: 'SKIPPED',
          error: healed.error || `No active service mapping found for metric "${item.metricType}"`,
        });
        continue;
      }
    }

    // Min-quantity clamping: clamp UP strictly to the specific service's minQuantity (e.g., 10 or 1), NOT hardcoded 100
    // This allows micro-engagements (likes, shares, comments: 10, 15) to dispatch cleanly while preventing provider drops
    if (mapping.minQuantity > 0 && item.quantity < mapping.minQuantity) {
      const clampedQty = mapping.minQuantity;
      console.log(
        `[SMM Dispatcher] Clamped ${item.metricType}: calculated ${item.quantity} -> ${clampedQty} (service min requirement: ${mapping.minQuantity})`
      );
      item = { ...item, quantity: clampedQty };
    }

    const estimatedCost = (item.quantity / 1000) * mapping.costPer1000;

    try {
      // Build form-urlencoded payload for standard SMMGen API v2 (service as clean numeric string)
      const sanitizedService = String(Number(cleanServiceId) || cleanServiceId);
      const baseParams: Record<string, string> = {
        key: provider.apiKey,
        action: 'add',
        service: sanitizedService,
        link: targetLink,
        quantity: item.quantity.toString(),
      };

      // For COMMENTS metric: include newline-separated comments text payload matching exact finalQty
      // Provider requires exactly 1 non-empty comment line per requested unit.
      if (item.metricType === 'COMMENTS' && item.quantity > 0) {
        baseParams.comments = generateRealisticCommentsPayload(item.quantity);
      }

      const params = new URLSearchParams(baseParams);

      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        // 15-second timeout signal
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      let json: SmmApiResponse = {};

      try {
        json = JSON.parse(text);
      } catch {
        json = { error: `Invalid provider JSON response: ${text.slice(0, 100)}` };
      }

      if (json.order !== undefined && json.order !== null) {
        // Success
        dispatchResults.push({
          metricType: item.metricType,
          serviceId: cleanServiceId,
          quantity: item.quantity,
          cost: estimatedCost,
          status: 'SUCCESS',
          providerOrderId: json.order,
          rawResponse: json,
        });
        totalSuccessfulCost += estimatedCost;
        successCount++;
      } else {
        // Check if error is due to incorrect/invalid service ID or active link lock
        const errorMsg = json.error || 'Provider rejected order dispatch';
        const isInvalidService = /incorrect service id|invalid service/i.test(String(errorMsg));
        const isActiveLinkLock = /active order with this link|wait until order being completed/i.test(String(errorMsg));

        if (isInvalidService) {
          console.warn(`[SMM Dispatcher] Detected invalid service ID "${cleanServiceId}" for ${item.metricType}. Triggering auto-heal...`);
          const healed = await autoHealAndRetryService(provider, item, targetLink);
          if (healed.success && healed.orderId) {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: healed.healedMapping?.serviceId || cleanServiceId,
              quantity: item.quantity,
              cost: healed.cost || estimatedCost,
              status: 'SUCCESS',
              providerOrderId: healed.orderId,
              rawResponse: healed.rawResponse,
            });
            totalSuccessfulCost += healed.cost || estimatedCost;
            successCount++;
            continue;
          } else if (healed.error === 'Skipped (Below Min)') {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: healed.healedMapping?.serviceId || cleanServiceId,
              quantity: item.quantity,
              cost: 0,
              status: 'SKIPPED',
              error: 'Skipped (Below Min)',
            });
            continue;
          } else {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: healed.healedMapping?.serviceId || cleanServiceId,
              quantity: item.quantity,
              cost: 0,
              status: 'FAILED',
              error: String(healed.error || errorMsg),
              rawResponse: healed.rawResponse || json,
            });
            failureCount++;
          }
        } else if (isActiveLinkLock) {
          console.warn(`[SMM Dispatcher] Active link lock detected for ${item.metricType}. Triggering failover...`);
          const failover = await handleActiveLinkFailoverAndRetry(provider, item, targetLink, cleanServiceId);
          if (failover.success && failover.orderId) {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: failover.serviceId || cleanServiceId,
              quantity: item.quantity,
              cost: failover.cost || estimatedCost,
              status: 'SUCCESS',
              providerOrderId: failover.orderId,
              rawResponse: failover.rawResponse,
            });
            totalSuccessfulCost += failover.cost || estimatedCost;
            successCount++;
            continue;
          } else {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: cleanServiceId,
              quantity: item.quantity,
              cost: 0,
              status: 'FAILED',
              error: String(failover.error || errorMsg),
              rawResponse: failover.rawResponse || json,
            });
            failureCount++;
          }
        } else {
          // Provider returned another error (e.g. Insufficient balance)
          dispatchResults.push({
            metricType: item.metricType,
            serviceId: cleanServiceId,
            quantity: item.quantity,
            cost: 0,
            status: 'FAILED',
            error: String(errorMsg),
            rawResponse: json,
          });
          failureCount++;
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isInvalidService = /incorrect service id|invalid service/i.test(errorMsg);
      const isActiveLinkLock = /active order with this link|wait until order being completed/i.test(errorMsg);

      if (isInvalidService) {
        console.warn(`[SMM Dispatcher] Detected invalid service error in exception for ${item.metricType}. Auto-healing...`);
        const healed = await autoHealAndRetryService(provider, item, targetLink);
        if (healed.success && healed.orderId) {
          dispatchResults.push({
            metricType: item.metricType,
            serviceId: healed.healedMapping?.serviceId || cleanServiceId,
            quantity: item.quantity,
            cost: healed.cost || estimatedCost,
            status: 'SUCCESS',
            providerOrderId: healed.orderId,
            rawResponse: healed.rawResponse,
          });
          totalSuccessfulCost += healed.cost || estimatedCost;
          successCount++;
          continue;
        }
      } else if (isActiveLinkLock) {
        console.warn(`[SMM Dispatcher] Detected active link lock error in exception for ${item.metricType}. Failover...`);
        const failover = await handleActiveLinkFailoverAndRetry(provider, item, targetLink, cleanServiceId);
        if (failover.success && failover.orderId) {
          dispatchResults.push({
            metricType: item.metricType,
            serviceId: failover.serviceId || cleanServiceId,
            quantity: item.quantity,
            cost: failover.cost || estimatedCost,
            status: 'SUCCESS',
            providerOrderId: failover.orderId,
            rawResponse: failover.rawResponse,
          });
          totalSuccessfulCost += failover.cost || estimatedCost;
          successCount++;
          continue;
        }
      }

      dispatchResults.push({
        metricType: item.metricType,
        serviceId: cleanServiceId,
        quantity: item.quantity,
        cost: 0,
        status: 'FAILED',
        error: `Network/API Dispatch Error: ${errorMsg}`,
      });
      failureCount++;
    }
  }

  // 5. Determine Overall Status using unified deterministic aggregation
  const overallStatus = aggregateParentOrderStatus(
    dispatchResults.map((d) => ({
      status: d.status === 'SUCCESS' && d.providerOrderId ? 'PROCESSING' : d.status === 'SKIPPED' ? 'SKIPPED' : 'FAILED',
      providerOrderId: d.providerOrderId !== undefined && d.providerOrderId !== null ? String(d.providerOrderId) : null,
    }))
  );

  // Gather concise error summaries if any
  const errors = dispatchResults
    .filter((d) => d.status === 'FAILED')
    .map((d) => `${d.metricType}: ${d.error}`);
  const errorMessage = errors.length > 0 ? errors.join(' | ') : null;

  // 6. Update Order and create/update individual OrderItem records in Prisma Database
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(
    async (tx: any) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: overallStatus,
          totalCost: totalSuccessfulCost,
          providerId: provider.id,
          providerResponsesJson: JSON.stringify(dispatchResults),
          errorMessage,
        },
      });

      // Remove any previously recorded items for this order before re-recording
      await tx.orderItem.deleteMany({
        where: { orderId: order.id },
      });

      // Insert OrderItem records in a single batch query
      const orderItemsData = dispatchResults.map((d) => {
        let initialStatus = 'Pending';
        if (d.status === 'SUCCESS' && d.providerOrderId) {
          initialStatus = 'Processing';
        } else if (d.status === 'SKIPPED') {
          initialStatus = 'Skipped';
        } else {
          initialStatus = 'Failed';
        }

        return {
          orderId: order.id,
          metricType: d.metricType,
          serviceId: d.serviceId ? String(d.serviceId).replace(/[^0-9]/g, '').trim() : null,
          quantity: d.quantity,
          cost: d.cost,
          providerOrderId: d.providerOrderId !== undefined && d.providerOrderId !== null ? String(d.providerOrderId) : null,
          status: initialStatus,
          startCount: null,
          remains: d.quantity,
          errorMessage: d.error || null,
        };
      });

      if (orderItemsData.length > 0) {
        await tx.orderItem.createMany({
          data: orderItemsData,
        });
      }
    },
    { timeout: 30000, maxWait: 15000 }
  );

  return {
    orderId: order.id,
    overallStatus,
    totalCost: totalSuccessfulCost,
    successfulItems: successCount,
    failedItems: failureCount,
    items: dispatchResults,
    providerId: provider.id,
    providerName: provider.name,
  };
}

/**
 * Sends action=cancel request to SMM provider for one or more active provider order IDs.
 */
export async function cancelProviderOrders(
  provider: { apiUrl: string; apiKey: string },
  orderIds: Array<string | number>
): Promise<Array<{ order: string | number; cancel?: string | number; error?: string }>> {
  if (!orderIds || orderIds.length === 0) return [];

  const cleanIds = orderIds
    .map((id) => String(id).replace(/[^0-9]/g, '').trim())
    .filter((id) => id.length > 0);

  if (cleanIds.length === 0) return [];

  const cleanUrl = provider.apiUrl.trim().replace(/\/+$/, '');
  const cleanKey = provider.apiKey.trim();

  try {
    const params = new URLSearchParams({
      key: cleanKey,
      action: 'cancel',
      orders: cleanIds.join(','),
    });

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return cleanIds.map((id) => ({ order: id, error: `Invalid response: ${text.slice(0, 100)}` }));
    }

    if (Array.isArray(json)) {
      return json as Array<{ order: string | number; cancel?: string | number; error?: string }>;
    } else if (typeof json === 'object' && json !== null) {
      return [json as { order: string | number; cancel?: string | number; error?: string }];
    }
    return [];
  } catch (err) {
    console.error('[SMM Dispatcher] cancelProviderOrders error:', err);
    return cleanIds.map((id) => ({ order: id, error: err instanceof Error ? err.message : String(err) }));
  }
}

/**
 * Queries action=status on SMM provider to capture live start count, remains, and status.
 */
export async function fetchProviderOrderStatus(
  provider: { apiUrl: string; apiKey: string },
  providerOrderId: string | number
): Promise<{ status?: string; charge?: string; start_count?: string | number; remains?: string | number; error?: string } | null> {
  const cleanUrl = provider.apiUrl.trim().replace(/\/+$/, '');
  const cleanKey = provider.apiKey.trim();
  const cleanId = String(providerOrderId).replace(/[^0-9]/g, '').trim();

  if (!cleanId) return null;

  try {
    const params = new URLSearchParams({
      key: cleanKey,
      action: 'status',
      order: cleanId,
    });

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch {
    // Non-blocking
  }
  return null;
}

export interface RefundCalculationResult {
  orderId: string;
  previousTotalCost: number;
  newTotalCost: number;
  refundedAmount: number;
  itemsUpdated: number;
  details: Array<{
    itemId: string;
    metricType: string;
    quantity: number;
    delivered: number;
    remains: number;
    originalCost: number;
    effectiveCost: number;
    refunded: number;
    status: string;
  }>;
}

/**
 * Unified Idempotent Refund & Cost Calculation Engine
 * 
 * Accurately calculates delivered vs undelivered units and refunds:
 * - 100% refund (cost = $0.0000) for CANCELED / FAILED / SKIPPED items with 0 delivered units.
 * - Proportional refund for PARTIAL or stopped items with partial delivery (charges only for delivered = quantity - remains).
 * - Fully idempotent: subsequent runs yield refundedAmount = 0 once DB is updated.
 */
export async function recalculateOrderCostsAndRefunds(orderId: string): Promise<RefundCalculationResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      provider: {
        include: {
          mappings: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const previousTotalCost = Number(order.totalCost || 0);

  // Map serviceId / metricType to costPer1000 for deterministic baseline cost computation
  const mappingRateMap = new Map<string, number>();
  if (order.provider?.mappings) {
    for (const m of order.provider.mappings) {
      mappingRateMap.set(m.metricType.toUpperCase(), m.costPer1000);
      if (m.serviceId) {
        mappingRateMap.set(String(m.serviceId).replace(/[^0-9]/g, ''), m.costPer1000);
      }
    }
  }

  let newTotalCost = 0;
  let itemsUpdated = 0;
  const details = [];

  for (const item of order.items) {
    const qty = Math.max(0, item.quantity);
    const metricKey = item.metricType.toUpperCase();
    const cleanSvc = item.serviceId ? String(item.serviceId).replace(/[^0-9]/g, '') : '';
    
    // Determine baseline costPer1000
    const fallbackRate = DEFAULT_DISPATCHER_MAPPINGS[metricKey]?.costPer1000 || 0;
    const ratePer1000 = mappingRateMap.get(cleanSvc) ?? mappingRateMap.get(metricKey) ?? fallbackRate;
    const originalBaselineCost = qty > 0 ? (qty / 1000) * ratePer1000 : (item.cost || 0);

    const normStatus = (item.status || 'Pending').toLowerCase();
    const isCompleted = normStatus.includes('complete');
    const isCanceled = normStatus.includes('cancel');
    const isPartial = normStatus.includes('partial');
    const isFailed = normStatus.includes('fail');
    const isSkipped = normStatus.includes('skip');

    let effectiveCost = originalBaselineCost;
    let delivered = qty;
    const remains = item.remains !== null && item.remains !== undefined ? Math.max(0, item.remains) : qty;

    if (isCompleted) {
      delivered = qty;
      effectiveCost = originalBaselineCost;
    } else if (isCanceled || isFailed || isSkipped) {
      // If stopped/canceled/failed:
      // If provider reported explicit remains > 0 and < qty, charge proportionally for delivered portion
      if (item.remains !== null && item.remains !== undefined && item.remains > 0 && item.remains < qty) {
        delivered = qty - item.remains;
        const unitCost = qty > 0 ? originalBaselineCost / qty : 0;
        effectiveCost = Number((delivered * unitCost).toFixed(6));
      } else {
        // 0 delivered units -> 100% full refund
        delivered = 0;
        effectiveCost = 0;
      }
    } else if (isPartial) {
      if (item.remains !== null && item.remains !== undefined && item.remains > 0 && item.remains < qty) {
        delivered = qty - item.remains;
      } else {
        delivered = 0;
      }
      const unitCost = qty > 0 ? originalBaselineCost / qty : 0;
      effectiveCost = Number((delivered * unitCost).toFixed(6));
    } else {
      // In progress / Processing / Pending
      delivered = 0;
      effectiveCost = originalBaselineCost;
    }

    const itemRefund = Math.max(0, originalBaselineCost - effectiveCost);

    // Update OrderItem in database if cost changed
    if (Math.abs(item.cost - effectiveCost) > 0.00001) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { cost: effectiveCost },
      });
      itemsUpdated++;
    }

    newTotalCost += effectiveCost;
    details.push({
      itemId: item.id,
      metricType: item.metricType,
      quantity: qty,
      delivered,
      remains,
      originalCost: originalBaselineCost,
      effectiveCost,
      refunded: itemRefund,
      status: item.status,
    });
  }

  // Rounded to 4 decimal places
  newTotalCost = Number(newTotalCost.toFixed(4));
  const refundedAmount = Math.max(0, Number((previousTotalCost - newTotalCost).toFixed(4)));

  // If order is completely canceled and all items have 0 cost, set order totalCost to 0
  const isOrderFullyCanceled = order.status === 'CANCELED' || order.items.every((i) => ['Canceled', 'Failed', 'Skipped'].includes(i.status));
  if (isOrderFullyCanceled && newTotalCost === 0) {
    newTotalCost = 0;
  }

  // Update parent order totalCost
  await prisma.order.update({
    where: { id: orderId },
    data: {
      totalCost: newTotalCost,
    },
  });

  return {
    orderId,
    previousTotalCost,
    newTotalCost,
    refundedAmount,
    itemsUpdated,
    details,
  };
}
