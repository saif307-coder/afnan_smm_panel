import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';
import { aggregateParentOrderStatus } from '@/utils/orderDeliveryProgress';

export async function OPTIONS() {
  return handleOptions();
}

interface SmmStatusResponse {
  status?: string;
  charge?: string;
  start_count?: string | number;
  remains?: string | number;
  currency?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Normalizes external provider status string to consistent internal capitalization.
 */
function normalizeStatus(rawStatus?: string): string {
  if (!rawStatus) return 'Pending';
  const s = rawStatus.trim().toLowerCase();
  if (s.includes('complete')) return 'Completed';
  if (s.includes('progress')) return 'In progress';
  if (s.includes('process')) return 'Processing';
  if (s.includes('cancel')) return 'Canceled';
  if (s.includes('partial')) return 'Partial';
  if (s.includes('fail')) return 'Failed';
  return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
}

/**
 * Core Status Sync Engine (Phase 7)
 * Fetches all active sub-orders, calls SMM Provider status API, updates DB,
 * and re-evaluates parent Order status.
 */
async function executeOrderSync() {
  const startTime = Date.now();

  // 1. Fetch sub-orders with active statuses that need live tracking
  const activeSubOrders = await prisma.orderItem.findMany({
    where: {
      providerOrderId: { not: null },
      status: {
        notIn: [
          'COMPLETED',
          'Completed',
          'CANCELED',
          'Canceled',
          'PARTIAL',
          'Partial',
          'SKIPPED',
          'Skipped',
        ],
      },
    },
    include: {
      order: {
        include: {
          provider: true,
        },
      },
    },
    take: 50,
  });

  if (activeSubOrders.length === 0) {
    return {
      success: true,
      message: 'No active sub-orders require status synchronization',
      itemsChecked: 0,
      itemsUpdated: 0,
      ordersEvaluated: 0,
      durationMs: Date.now() - startTime,
      details: [],
    };
  }

  // Fallback active provider if order does not have one attached
  const defaultProvider = await prisma.smmProvider.findFirst({
    where: { isActive: true },
  });

  const updatedItemIds: string[] = [];
  const affectedOrderIds = new Set<string>();
  const syncLogs: Array<{
    itemId: string;
    orderId: string;
    metricType: string;
    providerOrderId: string;
    oldStatus: string;
    newStatus: string;
    startCount: number | null;
    remains: number | null;
  }> = [];

  // 2. Iterate each sub-order and query provider status API
  for (const item of activeSubOrders) {
    const provider = item.order.provider || defaultProvider;
    if (!provider || !item.providerOrderId) {
      continue;
    }

    const cleanUrl = provider.apiUrl.trim().replace(/\/+$/, '');
    const cleanKey = provider.apiKey.trim();
    const externalOrderId = String(item.providerOrderId).trim();

    let statusData: SmmStatusResponse | null = null;

    try {
      // 2a. POST form-urlencoded to SMM Provider status action
      const formParams = new URLSearchParams({
        key: cleanKey,
        action: 'status',
        order: externalOrderId,
      });

      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
        signal: AbortSignal.timeout(9000),
        cache: 'no-store',
      });

      if (response.ok) {
        const text = await response.text();
        try {
          statusData = JSON.parse(text);
        } catch {
          statusData = null;
        }
      }
    } catch (err) {
      console.warn(`[Sync Engine] Error calling provider status for item ${item.id} (Order ${externalOrderId}):`, err);
    }

    // 2b. Fallback to GET query params if POST failed to get JSON
    if (!statusData || (!statusData.status && !statusData.error)) {
      try {
        const getUrl = `${cleanUrl}?key=${encodeURIComponent(cleanKey)}&action=status&order=${encodeURIComponent(externalOrderId)}`;
        const getRes = await fetch(getUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(9000),
          cache: 'no-store',
        });
        if (getRes.ok) {
          const text = await getRes.text();
          statusData = JSON.parse(text);
        }
      } catch {
        // Fallback also failed
      }
    }

    if (!statusData || !statusData.status) {
      continue;
    }

    const newStatus = normalizeStatus(statusData.status);
    const parsedStartCount =
      statusData.start_count !== undefined && statusData.start_count !== null && statusData.start_count !== ''
        ? parseInt(String(statusData.start_count), 10)
        : null;
    const parsedRemains =
      statusData.remains !== undefined && statusData.remains !== null && statusData.remains !== ''
        ? parseInt(String(statusData.remains), 10)
        : null;

    // 3. Update database record for this OrderItem
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        status: newStatus,
        startCount: !isNaN(Number(parsedStartCount)) ? parsedStartCount : item.startCount,
        remains: !isNaN(Number(parsedRemains)) ? parsedRemains : item.remains,
      },
    });

    updatedItemIds.push(item.id);
    affectedOrderIds.add(item.orderId);

    syncLogs.push({
      itemId: item.id,
      orderId: item.orderId,
      metricType: item.metricType,
      providerOrderId: externalOrderId,
      oldStatus: item.status,
      newStatus,
      startCount: !isNaN(Number(parsedStartCount)) ? parsedStartCount : item.startCount,
      remains: !isNaN(Number(parsedRemains)) ? parsedRemains : item.remains,
    });
  }

  // 4. Re-evaluate Parent Orders status based on updated child items
  let ordersUpdatedCount = 0;

  for (const orderId of affectedOrderIds) {
    const parentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!parentOrder || !parentOrder.items || parentOrder.items.length === 0) {
      continue;
    }

    const evaluatedStatus = aggregateParentOrderStatus(parentOrder.items);
    const computedTotalCost = parentOrder.items.reduce((acc, i) => acc + (i.cost || 0), 0);

    // Also update providerResponsesJson on parent order for backwards compatibility
    const updatedResponsesJson = JSON.stringify(
      parentOrder.items.map((i) => ({
        metricType: i.metricType,
        serviceId: i.serviceId,
        quantity: i.quantity,
        cost: i.cost,
        status: i.status === 'Failed' ? 'FAILED' : i.status === 'Skipped' ? 'SKIPPED' : 'SUCCESS',
        providerOrderId: i.providerOrderId,
        externalStatus: i.status,
        startCount: i.startCount,
        remains: i.remains,
      }))
    );

    const shouldUpdateCost = parentOrder.totalCost === 0 && computedTotalCost > 0;
    if (evaluatedStatus !== parentOrder.status || updatedResponsesJson !== parentOrder.providerResponsesJson || shouldUpdateCost) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: evaluatedStatus,
          providerResponsesJson: updatedResponsesJson,
          ...(shouldUpdateCost ? { totalCost: computedTotalCost } : {}),
        },
      });
      ordersUpdatedCount++;
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    message: `Synchronized ${updatedItemIds.length} sub-orders across ${affectedOrderIds.size} parent orders`,
    itemsChecked: activeSubOrders.length,
    itemsUpdated: updatedItemIds.length,
    ordersEvaluated: affectedOrderIds.size,
    ordersUpdated: ordersUpdatedCount,
    durationMs,
    details: syncLogs,
  };
}

/**
 * POST /api/cron/sync-orders
 * Protected live order tracking and status synchronization endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await executeOrderSync();
    return jsonResponse(result, { status: 200 });
  } catch (error) {
    console.error('POST /api/cron/sync-orders error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Live order sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/sync-orders
 * Supports external scheduler calls or health pings.
 */
export async function GET(req: NextRequest) {
  try {
    const result = await executeOrderSync();
    return jsonResponse(result, { status: 200 });
  } catch (error) {
    console.error('GET /api/cron/sync-orders error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Live order sync failed',
      },
      { status: 500 }
    );
  }
}
