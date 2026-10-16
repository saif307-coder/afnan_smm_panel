import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';
import {
  cancelProviderOrders,
  fetchProviderOrderStatus,
  recalculateOrderCostsAndRefunds,
} from '@/lib/smmDispatcher';

export async function OPTIONS() {
  return handleOptions();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/orders/[id]
 * Fetch single order with related provider and sub-order items.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return jsonResponse({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        provider: {
          select: { id: true, name: true, apiUrl: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      return jsonResponse({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return jsonResponse({ success: true, data: order });
  } catch (error) {
    console.error('GET /api/admin/orders/[id] error:', error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/orders/[id]
 * Updates order properties:
 * - targetUrl / targetReelUrl (fixes typos)
 * - status (e.g. CANCELED to manually stop & cancel at provider with instant refund)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return jsonResponse({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        provider: true,
      },
    });

    if (!existingOrder) {
      return jsonResponse({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // 1. Handle target URL update
    const newTargetUrl = body.targetUrl !== undefined ? body.targetUrl : body.targetReelUrl;
    if (newTargetUrl !== undefined) {
      if (typeof newTargetUrl === 'string' && newTargetUrl.trim().length > 0) {
        updateData.targetReelUrl = newTargetUrl.trim();
      } else if (newTargetUrl === null || newTargetUrl === '') {
        updateData.targetReelUrl = null;
      }
    }

    // 2. Handle Status update (e.g. CANCELED / Stop)
    let newStatus: string | undefined;
    if (body.status !== undefined && typeof body.status === 'string') {
      newStatus = body.status.trim().toUpperCase();
      updateData.status = newStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return jsonResponse(
        { success: false, error: 'No valid fields provided to update (targetUrl, status)' },
        { status: 400 }
      );
    }

    let refundedAmount = 0;
    let newTotalCost = existingOrder.totalCost;

    // Handle CANCELED order stop action
    if (newStatus === 'CANCELED') {
      const activeProvider =
        existingOrder.provider ||
        (await prisma.smmProvider.findFirst({
          where: { isActive: true },
        }));

      // Collect all active sub-orders that are not yet Completed
      const cancellableItems = existingOrder.items.filter(
        (i) => !['Completed', 'COMPLETED'].includes(i.status)
      );

      // 1. Query latest status from provider before cancellation to capture exact remains & start count
      if (activeProvider) {
        for (const item of cancellableItems) {
          if (item.providerOrderId) {
            try {
              const liveStatus = await fetchProviderOrderStatus(activeProvider, item.providerOrderId);
              if (liveStatus && liveStatus.remains !== undefined) {
                const parsedRemains = parseInt(String(liveStatus.remains), 10);
                const parsedStart = parseInt(String(liveStatus.start_count), 10);
                await prisma.orderItem.update({
                  where: { id: item.id },
                  data: {
                    remains: !isNaN(parsedRemains) ? parsedRemains : item.remains,
                    startCount: !isNaN(parsedStart) ? parsedStart : item.startCount,
                  },
                });
              }
            } catch (statusErr) {
              console.warn(`[Order Stop] Failed pre-cancel status query for item ${item.id}:`, statusErr);
            }
          }
        }

        // 2. Send action=cancel to provider API for all active provider order IDs
        const providerOrderIds = cancellableItems
          .map((i) => i.providerOrderId)
          .filter((id): id is string => Boolean(id));

        if (providerOrderIds.length > 0) {
          try {
            console.log(`[Order Stop] Calling action=cancel on provider for orders: ${providerOrderIds.join(',')}`);
            const cancelResults = await cancelProviderOrders(activeProvider, providerOrderIds);
            console.log(`[Order Stop] Provider cancel results:`, cancelResults);
          } catch (cancelErr) {
            console.error(`[Order Stop] Provider cancel error:`, cancelErr);
          }
        }
      }

      // 3. Mark non-completed items as Canceled in DB
      await prisma.orderItem.updateMany({
        where: {
          orderId: id,
          status: { notIn: ['Completed', 'COMPLETED'] },
        },
        data: {
          status: 'Canceled',
        },
      });

      // 4. Update parent order status to CANCELED
      await prisma.order.update({
        where: { id },
        data: updateData,
      });

      // 5. Execute unified idempotent refund and cost recalculation engine
      const refundResult = await recalculateOrderCostsAndRefunds(id);
      refundedAmount = refundResult.refundedAmount;
      newTotalCost = refundResult.newTotalCost;
    } else {
      // Non-cancel update (e.g. targetUrl)
      await prisma.order.update({
        where: { id },
        data: updateData,
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
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
      message:
        newStatus === 'CANCELED'
          ? `Order stopped & canceled at provider. Refunded: $${refundedAmount.toFixed(4)}`
          : 'Order updated successfully',
      refundedAmount,
      totalCost: newTotalCost,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('PATCH /api/admin/orders/[id] error:', error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/orders/[id]
 * Securely deletes an order and all cascading OrderItem relations.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return jsonResponse({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingOrder) {
      return jsonResponse({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Delete parent order (cascades to OrderItem automatically via Prisma relation)
    await prisma.order.delete({
      where: { id },
    });

    return jsonResponse({
      success: true,
      message: `Order #${id.slice(-8)} deleted successfully`,
      deletedId: id,
    });
  } catch (error) {
    console.error('DELETE /api/admin/orders/[id] error:', error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete order' },
      { status: 500 }
    );
  }
}
