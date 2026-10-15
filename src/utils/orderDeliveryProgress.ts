/**
 * Unified deterministic calculation engine for sub-order progress, delivered count, and remains.
 * Enforces consistent metrics across /dashboard (OrderTracker) and /admin.
 */

export interface SubOrderLike {
  status?: string | null;
  quantity?: number | null;
  providerOrderId?: string | number | null;
  remains?: number | null;
}

export interface SubOrderDeliveryResult {
  effectiveRemains: number;
  delivered: number;
  progress: number;
}

/**
 * Deterministic rules:
 * 1. ONLY has 100% progress (remains = 0, delivered = quantity) if subOrder.status === 'COMPLETED'
 * 2. If PENDING or !externalOrderId: remains = quantity, delivered = 0, progress = 0
 * 3. If SKIPPED or FAILED or CANCELED: remains = quantity, delivered = 0, progress = 0
 * 4. If PROCESSING or IN_PROGRESS or PARTIAL:
 *    - if remains is null/undefined (or remains === 0 before completion), remains = quantity, delivered = 0, progress = 0
 *    - otherwise: remains = Math.min(quantity, Math.max(0, remains)), delivered = quantity - remains, progress = Math.round((delivered / quantity) * 100)
 */
export function calculateSubOrderDelivery(item: SubOrderLike): SubOrderDeliveryResult {
  const normStatus = String(item.status || '').toUpperCase().trim();
  const quantity = Math.max(0, Number(item.quantity) || 0);

  if (quantity === 0) {
    return { effectiveRemains: 0, delivered: 0, progress: 100 };
  }

  // 1. Explicit COMPLETED
  if (normStatus === 'COMPLETED') {
    return {
      effectiveRemains: 0,
      delivered: quantity,
      progress: 100,
    };
  }

  // 2. Un-dispatched or PENDING
  const hasExtId = item.providerOrderId !== null && item.providerOrderId !== undefined && String(item.providerOrderId).trim() !== '' && String(item.providerOrderId).trim() !== 'NONE';
  if (normStatus === 'PENDING' || !hasExtId) {
    return {
      effectiveRemains: quantity,
      delivered: 0,
      progress: 0,
    };
  }

  // 3. SKIPPED / FAILED / CANCELED
  if (normStatus === 'SKIPPED' || normStatus === 'FAILED' || normStatus === 'CANCELED') {
    return {
      effectiveRemains: quantity,
      delivered: 0,
      progress: 0,
    };
  }

  // 4. Active fulfillment: PROCESSING / IN_PROGRESS / PARTIAL
  if (
    normStatus === 'PROCESSING' ||
    normStatus === 'IN_PROGRESS' ||
    normStatus === 'IN PROGRESS' ||
    normStatus === 'PARTIAL'
  ) {
    // If provider hasn't reported valid remains or reported 0 prematurely before status is COMPLETED
    if (
      item.remains === null ||
      item.remains === undefined ||
      isNaN(Number(item.remains)) ||
      Number(item.remains) === 0
    ) {
      return {
        effectiveRemains: quantity,
        delivered: 0,
        progress: 0,
      };
    }

    const parsedRemains = Math.min(quantity, Math.max(0, Math.floor(Number(item.remains))));
    const delivered = quantity - parsedRemains;
    const progress = Math.min(99, Math.max(0, Math.round((delivered / quantity) * 100)));

    return {
      effectiveRemains: parsedRemains,
      delivered,
      progress,
    };
  }

  // Fallback for any unknown status
  return {
    effectiveRemains: quantity,
    delivered: 0,
    progress: 0,
  };
}

/**
 * Aggregates parent order status strictly based on dispatched sub-orders:
 * - Filter dispatchedItems = items.filter(i => Boolean(i.providerOrderId) && i.status !== 'SKIPPED')
 * - If dispatchedItems.length === 0 -> FAILED (or PENDING if all PENDING with no ext ID)
 * - If ANY item is PENDING, PROCESSING, or IN_PROGRESS -> PROCESSING
 * - Only if dispatchedItems.length > 0 AND EVERY item is COMPLETED -> COMPLETED
 * - If some items completed/processing and some failed/canceled/partial -> PARTIAL
 */
export function aggregateParentOrderStatus(
  items: SubOrderLike[]
): 'COMPLETED' | 'PROCESSING' | 'PARTIAL' | 'FAILED' | 'CANCELED' | 'PENDING' {
  if (!items || items.length === 0) return 'FAILED';

  const dispatchedItems = items.filter((i) => {
    const hasExtId = i.providerOrderId !== null && i.providerOrderId !== undefined && String(i.providerOrderId).trim() !== '' && String(i.providerOrderId).trim() !== 'NONE';
    const norm = String(i.status || '').toUpperCase().trim();
    return hasExtId && norm !== 'SKIPPED';
  });

  if (dispatchedItems.length === 0) {
    const allPending = items.every((i) => String(i.status || '').toUpperCase().trim() === 'PENDING');
    if (allPending) return 'PENDING';
    return 'FAILED';
  }

  const allCompleted = dispatchedItems.every(
    (i) => String(i.status || '').toUpperCase().trim() === 'COMPLETED'
  );
  if (allCompleted) return 'COMPLETED';

  const allCanceled = dispatchedItems.every(
    (i) => String(i.status || '').toUpperCase().trim() === 'CANCELED'
  );
  if (allCanceled) return 'CANCELED';

  const allFailedOrCanceled = dispatchedItems.every((i) => {
    const s = String(i.status || '').toUpperCase().trim();
    return s === 'FAILED' || s === 'CANCELED';
  });
  if (allFailedOrCanceled) return 'FAILED';

  const hasAnyActive = dispatchedItems.some((i) => {
    const s = String(i.status || '').toUpperCase().trim();
    return s === 'PENDING' || s === 'PROCESSING' || s === 'IN_PROGRESS' || s === 'IN PROGRESS';
  });

  const hasAnyCompleted = dispatchedItems.some(
    (i) => String(i.status || '').toUpperCase().trim() === 'COMPLETED'
  );

  const hasAnyFailedOrPartial = dispatchedItems.some((i) => {
    const s = String(i.status || '').toUpperCase().trim();
    return s === 'FAILED' || s === 'PARTIAL' || s === 'CANCELED';
  });

  if (hasAnyCompleted && hasAnyFailedOrPartial) {
    return 'PARTIAL';
  }

  if (hasAnyActive) {
    return 'PROCESSING';
  }

  return 'PARTIAL';
}
