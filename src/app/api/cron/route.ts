import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse } from '@/lib/cors';
import { GET as syncOrdersGet, POST as syncOrdersPost } from './sync-orders/route';
import { GET as syncGet } from './sync/route';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Universal Cron Entrypoint: GET /api/cron
 * Automatically handles external cron pings, runs live order sync, and returns status.
 */
export async function GET(req: NextRequest) {
  try {
    const ordersRes = await syncOrdersGet(req);
    const legacyRes = await syncGet();

    const ordersData = await ordersRes.json().catch(() => ({}));
    const legacyData = await legacyRes.json().catch(() => ({}));

    return jsonResponse({
      success: true,
      message: 'Cron task executed successfully across all order systems',
      timestamp: new Date().toISOString(),
      orderItemSync: ordersData,
      legacySync: legacyData,
    });
  } catch (error) {
    console.error('Universal GET /api/cron error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron execution failed',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron
 */
export async function POST(req: NextRequest) {
  try {
    return await syncOrdersPost(req);
  } catch (error) {
    console.error('Universal POST /api/cron error:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron execution failed',
      },
      { status: 500 }
    );
  }
}
