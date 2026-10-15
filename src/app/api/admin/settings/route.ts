
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';
import { isValidPercentage, isValidRatio, ValidationError, validationError } from '@/lib/validators';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/admin/settings
 * Fetches the singleton admin settings row.
 * If none exists, creates one with default values and returns it.
 */
export async function GET() {
  try {
    let settings = await prisma.adminSettings.findFirst();

    if (!settings) {
      // Auto-seed the singleton row with defaults
      settings = await prisma.adminSettings.create({ data: {} });
    }

    return jsonResponse({ success: true, data: settings });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to fetch admin settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings
 * Updates the singleton admin settings row (upsert pattern).
 * Accepts partial updates — only provided fields are overwritten.
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

  // ── Validate each field if present ──
  const errors: ValidationError[] = [];
  const percentageFields = [
    'likesPercentage',
    'savesPercentage',
    'commentsPercentage',
    'sharesPercentage',
    'repostsPercentage',
    'followsPercentage',
    'viewersPercentage',
  ] as const;

  const updateData: Record<string, unknown> = {};

  for (const field of percentageFields) {
    if (body[field] !== undefined) {
      if (!isValidPercentage(body[field])) {
        errors.push(validationError(field, `${field} must be a number between 0 and 100`));
      } else {
        updateData[field] = body[field] as number;
      }
    }
  }

  if (body.avgWatchTimeRatio !== undefined) {
    if (!isValidRatio(body.avgWatchTimeRatio)) {
      errors.push(validationError('avgWatchTimeRatio', 'avgWatchTimeRatio must be a number between 0 and 1'));
    } else {
      updateData.avgWatchTimeRatio = body.avgWatchTimeRatio as number;
    }
  }

  if (body.CRON_STATUS_SYNC_ACTIVE !== undefined) {
    if (typeof body.CRON_STATUS_SYNC_ACTIVE !== 'boolean') {
      errors.push(validationError('CRON_STATUS_SYNC_ACTIVE', 'CRON_STATUS_SYNC_ACTIVE must be a boolean'));
    } else {
      updateData.CRON_STATUS_SYNC_ACTIVE = body.CRON_STATUS_SYNC_ACTIVE;
    }
  }

  if (errors.length > 0) {
    return jsonResponse({ success: false, errors }, { status: 400 });
  }

  if (Object.keys(updateData).length === 0) {
    return jsonResponse(
      { success: false, error: 'No valid fields provided to update' },
      { status: 400 }
    );
  }

  try {
    // Find existing or create
    let settings = await prisma.adminSettings.findFirst();

    if (settings) {
      settings = await prisma.adminSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      settings = await prisma.adminSettings.create({
        data: updateData as unknown as Parameters<typeof prisma.adminSettings.create>[0]['data'],
      });
    }

    return jsonResponse({ success: true, data: settings });
  } catch (error) {
    console.error('POST /api/admin/settings error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to update admin settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}
