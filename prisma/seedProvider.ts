import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFICIAL_PROVIDER = {
  name: 'SMM Pro Provider (Official Production)',
  apiUrl: 'https://my.smmgen.com/api/v2',
  apiKey: '04271cf8865171842ee08da1fdf5f5e4',
  isActive: true,
};

// BLACKLISTED IDs (permanently banned): 19741, 12897, 14366, 14749, 14750, 9685, 14548, 16946
// Verified working: #11610 Views (1-Hour Retention), #7465 Viewers/Reach, #19608 Shares, #14549 Reposts
const DEFAULT_MAPPINGS = [
  { metricType: 'VIEWS',     serviceId: '11610', costPer1000: 0.0016, minQuantity: 100 }, // 1-Hour Optimal High-Retention Views
  { metricType: 'VIEWERS',   serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Unique reach / impressions
  { metricType: 'REACH',     serviceId: '7465',  costPer1000: 0.0331, minQuantity: 100 }, // Unique reach alias
  { metricType: 'LIKES',     serviceId: '18302', costPer1000: 0.0100, minQuantity: 10  },
  { metricType: 'SAVES',     serviceId: '18302', costPer1000: 0.0029, minQuantity: 10  },
  { metricType: 'SHARES',    serviceId: '19608', costPer1000: 0.0010, minQuantity: 10  }, // VERIFIED WORKING
  { metricType: 'REPOSTS',   serviceId: '14549', costPer1000: 0.2938, minQuantity: 1   }, // VERIFIED WORKING
  { metricType: 'COMMENTS',  serviceId: '18803', costPer1000: 0.3000, minQuantity: 10  },
  { metricType: 'FOLLOWERS', serviceId: '17065', costPer1000: 0.2957, minQuantity: 10  },
];

export async function ensureOfficialProvider() {
  console.log('--- Initializing Official SMM Provider ---');

  // Deactivate any other providers or find existing with same URL
  let provider = await prisma.smmProvider.findFirst({
    where: { apiUrl: OFFICIAL_PROVIDER.apiUrl },
  });

  if (provider) {
    provider = await prisma.smmProvider.update({
      where: { id: provider.id },
      data: {
        name: OFFICIAL_PROVIDER.name,
        apiKey: OFFICIAL_PROVIDER.apiKey,
        isActive: true,
      },
    });
    console.log(`Updated existing active provider: ${provider.id} (${provider.name})`);
  } else {
    provider = await prisma.smmProvider.create({
      data: OFFICIAL_PROVIDER,
    });
    console.log(`Created new official provider: ${provider.id} (${provider.name})`);
  }

  // Ensure all other providers are marked inactive
  await prisma.smmProvider.updateMany({
    where: { id: { not: provider.id } },
    data: { isActive: false },
  });

  // Seed service mappings
  for (const m of DEFAULT_MAPPINGS) {
    await prisma.serviceMapping.upsert({
      where: {
        providerId_metricType: {
          providerId: provider.id,
          metricType: m.metricType,
        },
      },
      update: {
        serviceId: m.serviceId,
        costPer1000: m.costPer1000,
        minQuantity: m.minQuantity ?? 0,
        isActive: true,
      } as any,
      create: {
        providerId: provider.id,
        metricType: m.metricType,
        serviceId: m.serviceId,
        costPer1000: m.costPer1000,
        minQuantity: m.minQuantity ?? 0,
        isActive: true,
      } as any,
    });
    console.log(`  Mapped ${m.metricType} -> Service ID #${m.serviceId} ($${m.costPer1000}/1k, Min: ${m.minQuantity})`);
  }

  console.log('--- Official SMM Provider initialized successfully! ---');
  return provider;
}

if (require.main === module) {
  ensureOfficialProvider()
    .catch((err) => {
      console.error('Error seeding provider:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
