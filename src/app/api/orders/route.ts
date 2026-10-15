import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';
import { calculateQuantities, MetricPercentages } from '@/utils/calculator';
import { dispatchBundledOrder } from '@/lib/smmDispatcher';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/orders
 * Returns list of recent orders with dispatch status and breakdown.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        provider: {
          select: { id: true, name: true, apiUrl: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return jsonResponse({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Bundled order placement & automated provider dispatch.
 * 
 * Payload:
 * {
 *   targetReelUrl?: string,
 *   baseViews: number,
 *   percentages: MetricPercentages,
 *   autoDispatch?: boolean (default: true)
 * }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { success: false, error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  // 1. Validate Base Views
  const rawViews = body.baseViews;
  const baseViews = typeof rawViews === 'number' ? Math.floor(rawViews) : parseInt(String(rawViews), 10);
  if (isNaN(baseViews) || baseViews <= 0) {
    return jsonResponse(
      { success: false, error: 'baseViews must be a positive integer' },
      { status: 400 }
    );
  }

  const targetReelUrl = typeof body.targetReelUrl === 'string' && body.targetReelUrl.trim()
    ? body.targetReelUrl.trim()
    : null;

  // 2. Parse and Validate Percentages
  let percentages: Partial<MetricPercentages> = {};
  if (typeof body.percentages === 'object' && body.percentages !== null) {
    percentages = body.percentages as Partial<MetricPercentages>;
  } else if (typeof body.percentagesJson === 'string') {
    try {
      percentages = JSON.parse(body.percentagesJson);
    } catch {
      percentages = {};
    }
  }

  // 3. Compute exact integer quantities via Phase 3 Mathematical Engine
  const calculated = calculateQuantities(baseViews, percentages);

  try {
    // 4. Save Initial Order with status PENDING
    const initialOrder = await prisma.order.create({
      data: {
        targetReelUrl,
        baseViews: calculated.views,
        percentagesJson: JSON.stringify(percentages),
        calculatedMetricsJson: JSON.stringify(calculated),
        likes: calculated.likes,
        saves: calculated.saves,
        shares: calculated.shares,
        reposts: calculated.reposts,
        comments: calculated.comments,
        followers: calculated.followers,
        status: 'PENDING',
      },
    });

    // 5. Execute 3rd-Party SMM Provider Dispatch (Bundle Splitting)
    const shouldDispatch = body.autoDispatch !== false;
    let dispatchSummary = null;

    if (shouldDispatch) {
      dispatchSummary = await dispatchBundledOrder(initialOrder.id);
    }

    // 6. Fetch final order state
    const finalOrder = await prisma.order.findUnique({
      where: { id: initialOrder.id },
      include: {
        provider: {
          select: { id: true, name: true },
        },
        items: true,
      },
    });

    return jsonResponse(
      {
        success: true,
        message:
          dispatchSummary?.overallStatus === 'COMPLETED'
            ? 'Order dispatched successfully to SMM provider'
            : dispatchSummary?.overallStatus === 'PARTIAL'
            ? 'Order partially dispatched (some services failed)'
            : 'Order logged; provider dispatch failed (see details)',
        data: finalOrder,
        dispatch: dispatchSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process order',
      },
      { status: 500 }
    );
  }
}
