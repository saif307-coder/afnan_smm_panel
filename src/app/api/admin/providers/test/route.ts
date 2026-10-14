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

    const cleanUrl = String(apiUrl).trim().replace(/\/+$/, '');
    const cleanKey = String(apiKey).trim();

    const testUrl = `${cleanUrl}?key=${encodeURIComponent(cleanKey)}&action=balance`;

    let balanceResult: { balance?: string | number; currency?: string; error?: string } | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.balance !== undefined || json.error) {
          balanceResult = json;
        }
      } catch {
        // failed parse
      }
    } catch {
      // try fallback
    }

    if (!balanceResult || (balanceResult.balance === undefined && !balanceResult.error)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const formParams = new URLSearchParams();
        formParams.append('key', cleanKey);
        formParams.append('action', 'balance');

        const postRes = await fetch(cleanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formParams.toString(),
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);

        const postText = await postRes.text();
        const postJson = JSON.parse(postText);
        if (postJson.balance !== undefined || postJson.error) {
          balanceResult = postJson;
        }
      } catch {
        // fallback failed
      }
    }

    if (balanceResult && balanceResult.balance !== undefined) {
      return NextResponse.json({
        success: true,
        connected: true,
        balance: String(balanceResult.balance),
        currency: String(balanceResult.currency || 'USD'),
      });
    }

    if (balanceResult?.error) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: balanceResult.error,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      data: balanceResult,
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
