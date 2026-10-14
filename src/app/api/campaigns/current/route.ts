import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateReelMetrics } from '@/lib/metricsEngine';
import { handleOptions, jsonResponse } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(_req: NextRequest) {
  try {
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

    return jsonResponse({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error fetching current campaign:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch campaign',
      },
      { status: 500 }
    );
  }
}
