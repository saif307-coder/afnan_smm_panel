
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateReelMetrics } from '@/lib/metricsEngine';
import { handleOptions, jsonResponse } from '@/lib/cors';
import { getFallbackCampaign } from '@/lib/fallbackStore';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(_req: NextRequest) {
  try {
    if (!prisma) {
      throw new Error('PrismaClient is not initialized');
    }

    let campaign = await prisma.reelCampaign.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!campaign) {
      const defaultViews = 100000;
      const defaultDuration = 60;
      const computed = calculateReelMetrics(defaultViews, defaultDuration);

      campaign = await prisma.reelCampaign.create({
        data: {
          reelUrl: null,
          collaborationText: 'Collaboration with cinematic.edits.fx and songs_movies.byte',
          videoDurationSeconds: defaultDuration,
          views: defaultViews,
          viewers: computed.viewers,
          avgWatchTimeSeconds: computed.avgWatchTimeSeconds,
          follows: computed.follows,
          likes: 1500,
          comments: 0,
          reposts: 15,
          shares: 49,
          saves: 144,
          followersPercentage: computed.followersPercentage,
          nonFollowersPercentage: computed.nonFollowersPercentage,
          countriesJson: computed.countriesJson,
          graphDataJson: computed.graphDataJson,
          serviceStatus: 'IDLE',
        },
      });
    }

    // Keep memory store synchronized with latest DB data
    globalThis.__campaignFallbackStore = campaign;

    return jsonResponse({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.warn(
      'Database query failed (e.g. Vercel read-only filesystem). Serving from In-Memory Global State Fallback store:',
      error instanceof Error ? error.message : error
    );
    const fallbackData = getFallbackCampaign();
    return jsonResponse({
      success: true,
      data: fallbackData,
      source: 'in-memory-fallback',
    });
  }
}
