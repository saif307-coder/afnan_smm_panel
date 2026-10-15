/**
 * SMM Provider Dispatcher Service (Phase 4 & Auto-Healing)
 * 
 * Handles bundle splitting, external SMM API communication, error handling,
 * auto-healing fallback for invalid service IDs, and order state reconciliation with Prisma.
 */

import { prisma } from '@/lib/prisma';
import { ensureOfficialProvider } from '../../prisma/seedProvider';

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
  overallStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED';
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
 * Dynamically resolves the best active, cheapest service for a metric.
 */
export function matchBestActiveService(
  services: ProviderServiceItem[],
  metricType: string
): ProviderServiceItem | null {
  const normMetric = metricType.toUpperCase();
  const igServices = services.filter((s) => {
    const text = `${s.name} ${s.category || ''}`.toLowerCase();
    return text.includes('instagram') || text.includes('reel') || text.includes('post');
  });

  const filterByKeywords = (keywords: string[], exclude: string[] = []) => {
    return igServices
      .filter((s) => {
        const text = `${s.name} ${s.category || ''}`.toLowerCase();
        const matches = keywords.some((k) => text.includes(k.toLowerCase()));
        const isExcluded = exclude.some((e) => text.includes(e.toLowerCase()));
        return matches && !isExcluded;
      })
      .sort((a, b) => (parseFloat(String(a.rate)) || 0) - (parseFloat(String(b.rate)) || 0));
  };

  let candidates: ProviderServiceItem[] = [];

  switch (normMetric) {
    case 'VIEWS':
      candidates = filterByKeywords(['views', 'view'], ['story', 'live', 'igtv', 'like', 'save', 'comment', 'auto']);
      break;
    case 'LIKES':
      candidates = filterByKeywords(['likes', 'like'], ['comment', 'story', 'live', 'auto', 'view', 'save']);
      break;
    case 'SAVES':
      candidates = filterByKeywords(['saves', 'save'], ['story', 'auto']);
      break;
    case 'SHARES':
      candidates = filterByKeywords(['shares', 'share'], ['story', 'auto', 'facebook', 'tiktok']);
      break;
    case 'REPOSTS':
      candidates = filterByKeywords(['repost', 'reposts'], ['story', 'auto', 'tiktok', 'twitter']);
      break;
    case 'COMMENTS':
      candidates = filterByKeywords(['comment', 'comments'], ['like', 'story', 'auto', 'custom', 'verified', 'blue tick']);
      break;
    case 'FOLLOWERS':
    case 'FOLLOWS':
      candidates = filterByKeywords(['follower', 'followers'], ['story', 'auto']);
      break;
    default:
      candidates = [];
  }

  return candidates.length > 0 ? candidates[0] : null;
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
  if (!matched) {
    return { success: false, error: `No active replacement service found for metric "${item.metricType}"` };
  }

  const newServiceId = String(matched.service);
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
        serviceId: newServiceId,
        costPer1000: newRate,
        minQuantity: newMin,
        isActive: true,
      },
      create: {
        providerId: provider.id,
        metricType: item.metricType.toUpperCase(),
        serviceId: newServiceId,
        costPer1000: newRate,
        minQuantity: newMin,
        isActive: true,
      },
    });
    console.log(`[SMM Dispatcher Auto-Heal] Updated DB ServiceMapping: ${item.metricType} -> Service #${newServiceId} ($${newRate}/1k, min: ${newMin})`);
  } catch (dbErr) {
    console.error(`[SMM Dispatcher Auto-Heal] Failed to persist healed mapping in DB:`, dbErr);
  }

  const healedMapping = { serviceId: newServiceId, costPer1000: newRate, minQuantity: newMin };

  if (newMin > 0 && item.quantity < newMin) {
    return {
      success: false,
      healedMapping,
      error: 'Skipped (Below Min)',
    };
  }

  const estimatedCost = (item.quantity / 1000) * newRate;

  // Immediately retry dispatching with healed Service ID
  try {
    const params = new URLSearchParams({
      key: provider.apiKey,
      action: 'add',
      service: newServiceId,
      link: targetLink,
      quantity: item.quantity.toString(),
    });

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
      console.log(`[SMM Dispatcher Auto-Heal] Successfully dispatched ${item.metricType} with new Service #${newServiceId}! Order #${json.order}`);
      return {
        success: true,
        healedMapping,
        orderId: json.order,
        cost: estimatedCost,
        rawResponse: json,
      };
    } else {
      return {
        success: false,
        healedMapping,
        error: String(json.error || 'Retry rejected by provider'),
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

  // Map metricType -> mapping
  const mappingMap = new Map<string, { serviceId: string; costPer1000: number; minQuantity: number }>();
  for (const m of provider.mappings) {
    mappingMap.set(m.metricType.toUpperCase(), {
      serviceId: m.serviceId,
      costPer1000: m.costPer1000,
      minQuantity: (m as { minQuantity?: number }).minQuantity ?? 0,
    });
  }

  // 3. Build bundle list from order quantities
  const metricItems = [
    { metricType: 'VIEWS', quantity: order.baseViews },
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
  for (const item of metricItems) {
    if (item.quantity <= 0) {
      continue;
    }

    let mapping = mappingMap.get(item.metricType) || (item.metricType === 'FOLLOWERS' ? mappingMap.get('FOLLOWS') : undefined);
    
    // If no mapping exists yet, attempt auto-healing right away
    if (!mapping) {
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

    // Smart skipping logic: Check minimum quantity required by provider service mapping
    if (mapping.minQuantity > 0 && item.quantity < mapping.minQuantity) {
      console.log(`[SMM Dispatcher] Skipped ${item.metricType}: calculated ${item.quantity} is below minimum requirement (${mapping.minQuantity})`);
      dispatchResults.push({
        metricType: item.metricType,
        serviceId: mapping.serviceId,
        quantity: item.quantity,
        cost: 0,
        status: 'SKIPPED',
        error: 'Skipped (Below Min)',
      });
      continue;
    }

    const estimatedCost = (item.quantity / 1000) * mapping.costPer1000;

    try {
      // Build form-urlencoded payload for standard SMM API
      const params = new URLSearchParams({
        key: provider.apiKey,
        action: 'add',
        service: mapping.serviceId,
        link: targetLink,
        quantity: item.quantity.toString(),
      });

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
          serviceId: mapping.serviceId,
          quantity: item.quantity,
          cost: estimatedCost,
          status: 'SUCCESS',
          providerOrderId: json.order,
          rawResponse: json,
        });
        totalSuccessfulCost += estimatedCost;
        successCount++;
      } else {
        // Check if error is due to incorrect/invalid service ID
        const errorMsg = json.error || 'Provider rejected order dispatch';
        const isInvalidService = /incorrect service id|invalid service/i.test(String(errorMsg));

        if (isInvalidService) {
          console.warn(`[SMM Dispatcher] Detected invalid service ID "${mapping.serviceId}" for ${item.metricType}. Triggering auto-heal...`);
          const healed = await autoHealAndRetryService(provider, item, targetLink);
          if (healed.success && healed.orderId) {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: healed.healedMapping?.serviceId || mapping.serviceId,
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
              serviceId: healed.healedMapping?.serviceId || mapping.serviceId,
              quantity: item.quantity,
              cost: 0,
              status: 'SKIPPED',
              error: 'Skipped (Below Min)',
            });
            continue;
          } else {
            dispatchResults.push({
              metricType: item.metricType,
              serviceId: healed.healedMapping?.serviceId || mapping.serviceId,
              quantity: item.quantity,
              cost: 0,
              status: 'FAILED',
              error: String(healed.error || errorMsg),
              rawResponse: healed.rawResponse || json,
            });
            failureCount++;
          }
        } else {
          // Provider returned another error (e.g. Insufficient balance)
          dispatchResults.push({
            metricType: item.metricType,
            serviceId: mapping.serviceId,
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

      if (isInvalidService) {
        console.warn(`[SMM Dispatcher] Detected invalid service error in exception for ${item.metricType}. Auto-healing...`);
        const healed = await autoHealAndRetryService(provider, item, targetLink);
        if (healed.success && healed.orderId) {
          dispatchResults.push({
            metricType: item.metricType,
            serviceId: healed.healedMapping?.serviceId || mapping.serviceId,
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
      }

      dispatchResults.push({
        metricType: item.metricType,
        serviceId: mapping.serviceId,
        quantity: item.quantity,
        cost: 0,
        status: 'FAILED',
        error: `Network/API Dispatch Error: ${errorMsg}`,
      });
      failureCount++;
    }
  }

  // 5. Determine Overall Status
  let overallStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'FAILED';
  if (successCount > 0 && failureCount === 0) {
    overallStatus = 'COMPLETED';
  } else if (successCount > 0 && failureCount > 0) {
    overallStatus = 'PARTIAL';
  } else if (successCount === 0 && failureCount === 0 && dispatchResults.length > 0) {
    overallStatus = 'COMPLETED';
  } else {
    overallStatus = 'FAILED';
  }

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
        if (d.status === 'SUCCESS') {
          initialStatus = 'Pending';
        } else if (d.status === 'SKIPPED') {
          initialStatus = 'Skipped';
        } else {
          initialStatus = 'Failed';
        }

        return {
          orderId: order.id,
          metricType: d.metricType,
          serviceId: d.serviceId ? String(d.serviceId) : null,
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
