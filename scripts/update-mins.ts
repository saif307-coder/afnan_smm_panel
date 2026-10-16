import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Updating ServiceMapping to Low-Minimums (1-10) per Client Request ---');

  const activeProvider = await prisma.smmProvider.findFirst({
    where: { isActive: true },
    include: { mappings: true },
  });

  if (!activeProvider) {
    console.error('No active provider found!');
    process.exit(1);
  }

  console.log(`Active Provider: ${activeProvider.name} (${activeProvider.id})`);

  // Target verified low-minimum services and mappings
  const targetMappings = [
    { metricType: 'VIEWS',     serviceId: '11610', costPer1000: 0.0016, minQuantity: 100 }, // 1-Hour Optimal Views
    { metricType: 'VIEWERS',   serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Reach/Impressions
    { metricType: 'REACH',     serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Reach Alias
    { metricType: 'LIKES',     serviceId: '19262', costPer1000: 0.0324, minQuantity: 10  }, // Low-min (1-10) verified working
    { metricType: 'SAVES',     serviceId: '14548', costPer1000: 0.0392, minQuantity: 10  }, // Low-min (1-10) verified working
    { metricType: 'COMMENTS',  serviceId: '16949', costPer1000: 0.3794, minQuantity: 10  }, // Low-min (10) verified working Custom Comments
    { metricType: 'SHARES',    serviceId: '19608', costPer1000: 0.0010, minQuantity: 10  }, // Low-min (10) verified working
    { metricType: 'REPOSTS',   serviceId: '14549', costPer1000: 0.2938, minQuantity: 1   }, // Low-min (1) verified working
    { metricType: 'FOLLOWERS', serviceId: '17065', costPer1000: 0.2957, minQuantity: 10  }, // Low-min (10) verified working
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
          minQuantity: m.minQuantity,
          isActive: true,
        },
      });
      console.log(`✓ Updated ${m.metricType}: Svc #${m.serviceId} with minQuantity: ${m.minQuantity} ($${m.costPer1000}/1k)`);
    } else {
      await prisma.serviceMapping.create({
        data: {
          providerId: activeProvider.id,
          metricType: m.metricType,
          serviceId: m.serviceId,
          costPer1000: m.costPer1000,
          minQuantity: m.minQuantity,
          isActive: true,
        },
      });
      console.log(`✓ Created ${m.metricType}: Svc #${m.serviceId} with minQuantity: ${m.minQuantity} ($${m.costPer1000}/1k)`);
    }
  }

  console.log('--- Successfully completed low-minimum ServiceMapping update ---');
}

main()
  .catch((err) => {
    console.error('Error updating mins:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
