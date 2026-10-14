import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// In-memory cache to prevent spamming provider API with large service lists
let cachedServices: {
  providerId: string;
  timestamp: number;
  data: any[];
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export interface SmmServiceItem {
  service: number | string;
  name: string;
  type?: string;
  category?: string;
  rate: string | number;
  min: number | string;
  max: number | string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
}

/**
 * GET /api/admin/provider-services
 * Fetches the active SMM provider from DB and queries their live services list:
 * action=services
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const refresh = searchParams.get('refresh') === 'true';
    const searchQuery = searchParams.get('search')?.toLowerCase().trim();

    // 1. Get Provider from DB
    const provider = providerId
      ? await prisma.smmProvider.findUnique({ where: { id: providerId } })
      : await prisma.smmProvider.findFirst({ where: { isActive: true } });

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active SMM provider configured in database',
          count: 0,
          data: [],
        },
        { status: 404 }
      );
    }

    // 2. Check in-memory cache if refresh not requested
    const now = Date.now();
    if (
      !refresh &&
      cachedServices &&
      cachedServices.providerId === provider.id &&
      now - cachedServices.timestamp < CACHE_TTL_MS
    ) {
      let filtered = cachedServices.data;
      if (searchQuery) {
        filtered = filtered.filter(
          (s) =>
            String(s.service).includes(searchQuery) ||
            s.name?.toLowerCase().includes(searchQuery) ||
            s.category?.toLowerCase().includes(searchQuery)
        );
      }
      return NextResponse.json({
        success: true,
        cached: true,
        providerName: provider.name,
        providerUrl: provider.apiUrl,
        count: filtered.length,
        total: cachedServices.data.length,
        data: filtered,
      });
    }

    const cleanUrl = provider.apiUrl.trim().replace(/\/+$/, '');
    const cleanKey = provider.apiKey.trim();

    // 3. Make GET request to provider for action=services
    const testUrl = `${cleanUrl}?key=${encodeURIComponent(cleanKey)}&action=services`;

    let servicesList: SmmServiceItem[] | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          servicesList = json;
        } else if (json.error) {
          throw new Error(json.error);
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
    } catch {
      // GET failed or timed out, attempt POST fallback
    }

    // 4. POST fallback for panels requiring POST
    if (!servicesList) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const formParams = new URLSearchParams();
        formParams.append('key', cleanKey);
        formParams.append('action', 'services');

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
        if (Array.isArray(postJson)) {
          servicesList = postJson;
        } else if (postJson.error) {
          throw new Error(postJson.error);
        }
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error:
              err instanceof Error
                ? err.message
                : 'Failed to fetch services from provider',
            count: 0,
            data: [],
          },
          { status: 502 }
        );
      }
    }

    if (!Array.isArray(servicesList)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider returned invalid or non-array services response',
          count: 0,
          data: [],
        },
        { status: 502 }
      );
    }

    // 5. Update Cache
    cachedServices = {
      providerId: provider.id,
      timestamp: now,
      data: servicesList,
    };

    let result = servicesList;
    if (searchQuery) {
      result = result.filter(
        (s) =>
          String(s.service).includes(searchQuery) ||
          s.name?.toLowerCase().includes(searchQuery) ||
          s.category?.toLowerCase().includes(searchQuery)
      );
    }

    return NextResponse.json({
      success: true,
      cached: false,
      providerName: provider.name,
      providerUrl: provider.apiUrl,
      count: result.length,
      total: servicesList.length,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error while fetching services',
        count: 0,
        data: [],
      },
      { status: 500 }
    );
  }
}
