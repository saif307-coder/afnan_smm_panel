import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Updating ServiceMapping minimum quantities to 100 ---');

  const activeProvider = await prisma.smmProvider.findFirst({
    where: { isActive: true },
    include: { mappings: true },
  });

  if (!activeProvider) {
    console.error('No active provider found!');
    process.exit(1);
  }

  console.log(`Active Provider: ${activeProvider.name} (${activeProvider.id})`);

  // Target verified services and mappings with minimum 100
  const targetMappings = [
    { metricType: 'VIEWS',     serviceId: '11610', costPer1000: 0.0016, minQuantity: 100 }, // 1-Hour Optimal Views
    { metricType: 'VIEWERS',   serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Reach/Impressions
    { metricType: 'REACH',     serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Reach Alias
    { metricType: 'LIKES',     serviceId: '19262', costPer1000: 0.0324, minQuantity: 100 }, // Verified working IG Likes
    { metricType: 'SAVES',     serviceId: '14548', costPer1000: 0.0392, minQuantity: 100 }, // Verified working IG Saves
    { metricType: 'COMMENTS',  serviceId: '16949', costPer1000: 0.3794, minQuantity: 100 }, // Verified working IG Custom Comments
    { metricType: 'SHARES',    serviceId: '19608', costPer1000: 0.0010, minQuantity: 100 }, // Verified working IG Shares
    { metricType: 'REPOSTS',   serviceId: '14549', costPer1000: 0.2938, minQuantity: 100 }, // Verified working IG Reposts
    { metricType: 'FOLLOWERS', serviceId: '17065', costPer1000: 0.2957, minQuantity: 100 }, // Verified working IG Followers
  ];

  for (const m of targetMappings) {
    const existing = await prisma.serviceMapping.findFirst({
      where: {
        providerId: activeProvider.id,
        metricType: m.metricType,
      },
    });

    if (existing) {
      await prisma.serviceMapping.update({
        where: { id: existing.id },
        data: {
          serviceId: m.serviceId,
          costPer1000: m.costPer1000,
          minQuantity: 100,
          isActive: true,
        },
      });
      console.log(`✓ Updated ${m.metricType}: Svc #${m.serviceId} with minQuantity: 100 ($${m.costPer1000}/1k)`);
    } else {
      await prisma.serviceMapping.create({
        data: {
          providerId: activeProvider.id,
          metricType: m.metricType,
          serviceId: m.serviceId,
          costPer1000: m.costPer1000,
          minQuantity: 100,
          isActive: true,
        },
      });
      console.log(`✓ Created ${m.metricType}: Svc #${m.serviceId} with minQuantity: 100 ($${m.costPer1000}/1k)`);
    }
  }

  // Also enforce minQuantity >= 100 on ALL records across all providers
  const updateResult = await prisma.serviceMapping.updateMany({
    where: {
      minQuantity: { lt: 100 },
    },
    data: {
      minQuantity: 100,
    },
  });

  console.log(`Enforced minQuantity >= 100 on ${updateResult.count} additional mapping records.`);
  console.log('--- Successfully completed ServiceMapping update ---');
}

main()
  .catch((err) => {
    console.error('Error updating mins:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
