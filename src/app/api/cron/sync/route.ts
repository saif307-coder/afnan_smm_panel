import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';


export async function OPTIONS() {
  return handleOptions();
}

interface ProviderOrderItem {
  metricType: string;
  serviceId?: string;
  quantity: number;
  cost: number;
  status: string;
  providerOrderId?: string | number;
  error?: string;
  rawResponse?: unknown;
  externalStatus?: string;
  remains?: string | number;
}

interface SmmStatusResponse {
  status?: string;
  charge?: string;
  start_count?: string;
  remains?: string;
  currency?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Core sync logic executed by Vercel Cron or manual trigger from Admin panel.
 */
async function executeCronSync() {
  const startTime = Date.now();

  // 1. Mandatory Kill Switch Check: Verify CRON_STATUS_SYNC_ACTIVE in AdminSettings
  let settings = await prisma.adminSettings.findFirst();

  if (!settings) {
    // If no row exists yet, auto-create default row (CRON_STATUS_SYNC_ACTIVE defaults to true)
    settings = await prisma.adminSettings.create({ data: {} });
  }

  // Check Kill Switch
  const isCronActive = (settings as { CRON_STATUS_SYNC_ACTIVE?: boolean })?.CRON_STATUS_SYNC_ACTIVE ?? true;
  if (!isCronActive) {
    return {
      status: 200,
      body: {
        success: true,
        message: 'Cron is paused by Admin',
        active: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 2. Cron is ACTIVE -> Perform synchronization tasks
  // Find orders that are currently pending, processing, or partial
  const ordersToSync = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING', 'PARTIAL'] },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: {
      provider: true,
    },
  });

  const syncDetails: Array<{
    orderId: string;
    previousStatus: string;
    newStatus: string;
    updatedItems: number;
  }> = [];

  let updatedOrdersCount = 0;

  for (const order of ordersToSync) {
    if (!order.providerResponsesJson || !order.provider) {
      continue;
    }

    let items: ProviderOrderItem[] = [];
    try {
      items = JSON.parse(order.providerResponsesJson);
    } catch {
      continue;
    }

    if (!Array.isArray(items) || items.length === 0) {
      continue;
    }

    const provider = order.provider;
    const cleanUrl = provider.apiUrl.trim().replace(/\/+$/, '');
    const cleanKey = provider.apiKey.trim();

    let itemsModified = false;
    let itemsCompletedCount = 0;
    let itemsTotalCount = 0;

    for (const item of items) {
      if (!item.providerOrderId || item.status === 'SKIPPED') {
        continue;
      }

      itemsTotalCount++;

      // If already marked as Completed externally, count and continue
      if (item.externalStatus === 'Completed' || item.externalStatus === 'COMPLETED') {
        itemsCompletedCount++;
        continue;
      }

      try {
        // Query SMM Provider status action
        const formParams = new URLSearchParams({
          key: cleanKey,
          action: 'status',
          order: String(item.providerOrderId),
        });

        const statusRes = await fetch(cleanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formParams.toString(),
          signal: AbortSignal.timeout(8000),
          cache: 'no-store',
        });

        if (statusRes.ok) {
          const text = await statusRes.text();
          let json: SmmStatusResponse = {};
          try {
            json = JSON.parse(text);
          } catch {
            json = {};
          }

          if (json.status) {
            item.externalStatus = String(json.status);
            if (json.remains !== undefined) {
              item.remains = json.remains;
            }
            itemsModified = true;

            const normalizedStatus = String(json.status).toLowerCase();
            if (normalizedStatus === 'completed') {
              itemsCompletedCount++;
            }
          }
        }
      } catch (err) {
        console.warn(`[Cron Sync] Failed to query status for provider order ${item.providerOrderId}:`, err);
      }
    }

    // Determine if overall order status changed
    let newOrderStatus = order.status;
    if (itemsTotalCount > 0 && itemsCompletedCount === itemsTotalCount) {
      newOrderStatus = 'COMPLETED';
    } else if (itemsCompletedCount > 0) {
      newOrderStatus = 'PROCESSING';
    }

    if (itemsModified || newOrderStatus !== order.status) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: newOrderStatus,
          providerResponsesJson: JSON.stringify(items),
        },
      });

      updatedOrdersCount++;
      syncDetails.push({
        orderId: order.id,
        previousStatus: order.status,
        newStatus: newOrderStatus,
        updatedItems: itemsCompletedCount,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    status: 200,
    body: {
      success: true,
      message: 'Cron sync completed successfully',
      active: true,
      timestamp: new Date().toISOString(),
      durationMs,
      syncedOrdersCount: ordersToSync.length,
      updatedOrdersCount,
      details: syncDetails,
    },
  };
}

/**
 * GET /api/cron/sync
 * Standard entrypoint invoked by Vercel Cron.
 */
export async function GET() {
  try {
    const result = await executeCronSync();
    return jsonResponse(result.body, { status: result.status });
  } catch (error) {
    console.error('GET /api/cron/sync error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron synchronization failed',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/sync
 * Manual trigger entrypoint from Admin Panel.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await executeCronSync();
    return jsonResponse(result.body, { status: result.status });
  } catch (error) {
    console.error('POST /api/cron/sync error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Manual sync trigger failed',
      },
      { status: 500 }
    );
  }
}
