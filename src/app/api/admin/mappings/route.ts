
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';
import {
  isNonEmptyString,
  isValidMetricType,
  isValidNumber,
  VALID_METRIC_TYPES,
  ValidationError,
  validationError,
} from '@/lib/validators';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/admin/mappings
 * Returns all service mappings, optionally filtered by providerId.
 * Query params: ?providerId=xxx (optional)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get('providerId');

  try {
    const where = providerId ? { providerId } : {};

    const mappings = await prisma.serviceMapping.findMany({
      where,
      orderBy: [{ providerId: 'asc' }, { metricType: 'asc' }],
      include: {
        provider: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    return jsonResponse({ success: true, data: mappings });
  } catch (error) {
    console.error('GET /api/admin/mappings error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to fetch service mappings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/mappings
 * Creates or updates a service mapping (upsert on providerId + metricType).
 * Required: providerId, metricType, serviceId
 * Optional: costPer1000, isActive
 *
 * Uses upsert so that re-posting the same (providerId, metricType) pair
 * updates the existing mapping instead of throwing a unique constraint error.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const errors: ValidationError[] = [];

  if (!isNonEmptyString(body.providerId)) {
    errors.push(validationError('providerId', 'providerId is required'));
  }

  if (!isValidMetricType(body.metricType)) {
    errors.push(
      validationError(
        'metricType',
        `metricType must be one of: ${VALID_METRIC_TYPES.join(', ')}`
      )
    );
  }

  if (!isNonEmptyString(body.serviceId)) {
    errors.push(validationError('serviceId', 'serviceId is required and must be a non-empty string'));
  }

  if (body.costPer1000 !== undefined && !isValidNumber(body.costPer1000, { min: 0 })) {
    errors.push(validationError('costPer1000', 'costPer1000 must be a non-negative number'));
  }

  if (errors.length > 0) {
    return jsonResponse({ success: false, errors }, { status: 400 });
  }

  const providerId = (body.providerId as string).trim();
  const metricType = body.metricType as string;
  const serviceId = (body.serviceId as string).trim();
  const costPer1000 = typeof body.costPer1000 === 'number' ? body.costPer1000 : 0;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  try {
    // Verify the provider exists
    const provider = await prisma.smmProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return jsonResponse(
        { success: false, error: `Provider with id "${providerId}" not found` },
        { status: 404 }
      );
    }

    // Upsert: create or update based on unique (providerId, metricType)
    const mapping = await prisma.serviceMapping.upsert({
      where: {
        providerId_metricType: { providerId, metricType },
      },
      update: {
        serviceId,
        costPer1000,
        isActive,
      },
      create: {
        providerId,
        metricType,
        serviceId,
        costPer1000,
        isActive,
      },
      include: {
        provider: {
          select: { id: true, name: true },
        },
      },
    });

    return jsonResponse({ success: true, data: mapping }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/mappings error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to create/update service mapping' },
      { status: 500 }
    );
  }
}
