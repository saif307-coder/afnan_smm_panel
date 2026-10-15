import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';

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
 * - status (e.g. CANCELED to manually stop)
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
      include: { items: true },
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

    // Execute atomic update
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // If status changed to CANCELED, update non-completed items to Canceled
      if (newStatus === 'CANCELED') {
        await tx.orderItem.updateMany({
          where: {
            orderId: id,
            status: { notIn: ['Completed', 'COMPLETED'] },
          },
          data: {
            status: 'Canceled',
          },
        });
      }

      // If target URL changed, update the order
      const order = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          provider: {
            select: { id: true, name: true, apiUrl: true },
          },
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return order;
    });

    return jsonResponse({
      success: true,
      message:
        newStatus === 'CANCELED'
          ? 'Order status updated to CANCELED (stopped)'
          : 'Order updated successfully',
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
