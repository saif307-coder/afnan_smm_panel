import { NextRequest, NextResponse } from 'next/server';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/admin/providers/test
 * Tests connectivity to an SMM Provider by pinging their 'balance' action.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiUrl, apiKey } = body || {};

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'apiUrl and apiKey are required' },
        { status: 400 }
      );
    }

    const testUrl = `${apiUrl.replace(/\/+$/, '')}?key=${encodeURIComponent(
      apiKey
    )}&action=balance`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (json.balance !== undefined) {
      return NextResponse.json({
        success: true,
        connected: true,
        balance: json.balance,
        currency: json.currency || 'USD',
      });
    }

    if (json.error) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: json.error,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      data: json,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      },
      { status: 500 }
    );
  }
}
