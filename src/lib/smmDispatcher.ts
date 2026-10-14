/**
 * SMM Provider Dispatcher Service (Phase 4)
 * 
 * Handles bundle splitting, external SMM API communication, error handling,
 * and order state reconciliation with Prisma.
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
  const mappingMap = new Map<string, { serviceId: string; costPer1000: number }>();
  for (const m of provider.mappings) {
    mappingMap.set(m.metricType.toUpperCase(), {
      serviceId: m.serviceId,
      costPer1000: m.costPer1000,
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

  // 4. Iterate and dispatch each metric with quantity > 0
  for (const item of metricItems) {
    if (item.quantity <= 0) {
      continue;
    }

    const mapping = mappingMap.get(item.metricType);
    if (!mapping) {
      dispatchResults.push({
        metricType: item.metricType,
        quantity: item.quantity,
        cost: 0,
        status: 'SKIPPED',
        error: `No active service mapping found for metric "${item.metricType}"`,
      });
      continue;
    }

    const estimatedCost = (item.quantity / 1000) * mapping.costPer1000;
    const targetLink = order.targetReelUrl || 'https://www.instagram.com/reel/session_default/';

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
        // Provider returned an error (e.g. Insufficient balance)
        const errorMsg = json.error || 'Provider rejected order dispatch';
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
    } catch (err) {
      // Network timeout or unexpected error
      const errorMsg = err instanceof Error ? err.message : String(err);
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
  } else {
    overallStatus = 'FAILED';
  }

  // Gather concise error summaries if any
  const errors = dispatchResults
    .filter((d) => d.status === 'FAILED')
    .map((d) => `${d.metricType}: ${d.error}`);
  const errorMessage = errors.length > 0 ? errors.join(' | ') : null;

  // 6. Update Order in Prisma Database
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: overallStatus,
      totalCost: totalSuccessfulCost,
      providerId: provider.id,
      providerResponsesJson: JSON.stringify(dispatchResults),
      errorMessage,
    },
  });

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
