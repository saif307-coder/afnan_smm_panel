
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions, jsonResponse } from '@/lib/cors';
import {
  isNonEmptyString,
  isValidUrl,
  ValidationError,
  validationError,
} from '@/lib/validators';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/admin/providers
 * Returns all SMM providers, ordered by creation date descending.
 * Includes their service mappings count.
 */
export async function GET() {
  try {
    const providers = await prisma.smmProvider.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { mappings: true } },
      },
    });

    return jsonResponse({ success: true, data: providers });
  } catch (error) {
    console.error('GET /api/admin/providers error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/providers
 * Creates a new SMM provider.
 * Required fields: name, apiUrl, apiKey
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

  if (!isNonEmptyString(body.name)) {
    errors.push(validationError('name', 'name is required and must be a non-empty string'));
  }
  if (!isValidUrl(body.apiUrl)) {
    errors.push(validationError('apiUrl', 'apiUrl must be a valid URL (e.g. https://example.com/api)'));
  }
  if (!isNonEmptyString(body.apiKey)) {
    errors.push(validationError('apiKey', 'apiKey is required and must be a non-empty string'));
  }

  if (errors.length > 0) {
    return jsonResponse({ success: false, errors }, { status: 400 });
  }

  try {
    const provider = await prisma.smmProvider.create({
      data: {
        name: (body.name as string).trim(),
        apiUrl: (body.apiUrl as string).trim(),
        apiKey: (body.apiKey as string).trim(),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    });

    return jsonResponse({ success: true, data: provider }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/providers error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to create provider' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/providers
 * Updates an existing SMM provider by ID (passed in request body).
 * Required: id. Optional: name, apiUrl, apiKey, isActive
 */
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!isNonEmptyString(body.id)) {
    return jsonResponse(
      { success: false, error: 'id is required to update a provider' },
      { status: 400 }
    );
  }

  const errors: ValidationError[] = [];
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      errors.push(validationError('name', 'name must be a non-empty string'));
    } else {
      updateData.name = (body.name as string).trim();
    }
  }

  if (body.apiUrl !== undefined) {
    if (!isValidUrl(body.apiUrl)) {
      errors.push(validationError('apiUrl', 'apiUrl must be a valid URL'));
    } else {
      updateData.apiUrl = (body.apiUrl as string).trim();
    }
  }

  if (body.apiKey !== undefined) {
    if (!isNonEmptyString(body.apiKey)) {
      errors.push(validationError('apiKey', 'apiKey must be a non-empty string'));
    } else {
      updateData.apiKey = (body.apiKey as string).trim();
    }
  }

  if (body.isActive !== undefined) {
    updateData.isActive = Boolean(body.isActive);
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
    const provider = await prisma.smmProvider.update({
      where: { id: body.id as string },
      data: updateData,
    });

    return jsonResponse({ success: true, data: provider });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return jsonResponse(
        { success: false, error: `Provider with id "${body.id}" not found` },
        { status: 404 }
      );
    }
    console.error('PUT /api/admin/providers error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to update provider' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/providers
 * Deletes an SMM provider by ID (passed as query param ?id=xxx).
 * Cascade-deletes all associated ServiceMappings.
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id || !id.trim()) {
    return jsonResponse(
      { success: false, error: 'Query parameter "id" is required' },
      { status: 400 }
    );
  }

  try {
    await prisma.smmProvider.delete({
      where: { id },
    });

    return jsonResponse({ success: true, message: `Provider "${id}" and its mappings deleted` });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return jsonResponse(
        { success: false, error: `Provider with id "${id}" not found` },
        { status: 404 }
      );
    }
    console.error('DELETE /api/admin/providers error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to delete provider' },
      { status: 500 }
    );
  }
}
