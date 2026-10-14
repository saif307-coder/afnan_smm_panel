import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/admin/providers/balance
 * Fetches the active SMM provider from DB, pings their 'balance' action,
 * and returns the live account balance.
 */
export async function GET() {
  try {
    const provider = await prisma.smmProvider.findFirst({
      where: { isActive: true },
    });

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'No active SMM provider configured',
        balance: '0.0000',
        currency: 'USD',
      });
    }

    const cleanUrl = provider.apiUrl.trim().replace(/\/+$/, '');
    const cleanKey = provider.apiKey.trim();

    // 1. Try GET request with query params
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
        if (json.balance !== undefined) {
          balanceResult = json;
        }
      } catch {
        // failed parse
      }
    } catch {
      // GET failed, try POST fallback
    }

    // 2. Fallback to POST (standard for some SMM rental panels)
    if (!balanceResult || balanceResult.balance === undefined) {
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
        if (postJson.balance !== undefined) {
          balanceResult = postJson;
        }
      } catch {
        // fallback also failed
      }
    }

    if (balanceResult && balanceResult.balance !== undefined) {
      return NextResponse.json({
        success: true,
        connected: true,
        balance: String(balanceResult.balance),
        currency: String(balanceResult.currency || 'USD'),
        providerName: provider.name,
        providerUrl: provider.apiUrl,
      });
    }

    return NextResponse.json({
      success: false,
      error: balanceResult?.error || 'Failed to fetch provider balance',
      balance: '0.0000',
      currency: 'USD',
      providerName: provider.name,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to provider',
      balance: '0.0000',
      currency: 'USD',
    });
  }
}
