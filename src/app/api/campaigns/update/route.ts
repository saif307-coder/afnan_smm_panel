import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateReelMetrics } from '@/lib/metricsEngine';
import { handleOptions, jsonResponse } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Find the current campaign if it exists
    const current = await prisma.reelCampaign.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const views = typeof body.views === 'number' ? Math.max(0, body.views) : (current?.views ?? 100000);
    const videoDurationSeconds =
      typeof body.videoDurationSeconds === 'number'
        ? Math.max(1, body.videoDurationSeconds)
        : (current?.videoDurationSeconds ?? 60);

    const countryLabelFormat = body.countryLabelFormat === 'United States' ? 'United States' : 'USA';

    // Calculate metrics using strict mathematical engine
    const computed = calculateReelMetrics(views, videoDurationSeconds, undefined, countryLabelFormat);

    const updateData = {
      reelUrl: body.reelUrl !== undefined ? body.reelUrl : (current?.reelUrl ?? null),
      collaborationText:
        body.collaborationText !== undefined
          ? String(body.collaborationText)
          : (current?.collaborationText ?? 'Collaboration with cinematic.edits.fx and songs_movies.byte'),
      videoDurationSeconds,
      views,
      viewers: computed.viewers,
      avgWatchTimeSeconds: computed.avgWatchTimeSeconds,
      follows: computed.follows,
      likes: typeof body.likes === 'number' ? body.likes : (current?.likes ?? 1500),
      comments: typeof body.comments === 'number' ? body.comments : (current?.comments ?? 0),
      reposts: typeof body.reposts === 'number' ? body.reposts : (current?.reposts ?? 15),
      shares: typeof body.shares === 'number' ? body.shares : (current?.shares ?? 49),
      saves: typeof body.saves === 'number' ? body.saves : (current?.saves ?? 144),
      followersPercentage: computed.followersPercentage,
      nonFollowersPercentage: computed.nonFollowersPercentage,
      countriesJson: computed.countriesJson,
      graphDataJson: computed.graphDataJson,
      serviceStatus: body.serviceStatus ? String(body.serviceStatus) : (current?.serviceStatus ?? 'IDLE'),
    };

    let updatedCampaign;
    if (current?.id) {
      updatedCampaign = await prisma.reelCampaign.update({
        where: { id: current.id },
        data: updateData,
      });
    } else {
      updatedCampaign = await prisma.reelCampaign.create({
        data: updateData,
      });
    }

    return jsonResponse({
      success: true,
      data: updatedCampaign,
      computedTicks: computed.ticks,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update campaign',
      },
      { status: 500 }
    );
  }
}
