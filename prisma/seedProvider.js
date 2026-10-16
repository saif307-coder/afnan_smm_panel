const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const OFFICIAL_PROVIDER = {
  name: 'SMM Pro Provider (Official Production)',
  apiUrl: 'https://smmproprovider.online/api/v2',
  apiKey: 'f33672c260df0b9870026508f1e176d1',
  isActive: true,
};

// BLACKLISTED IDs (permanently banned): 19741, 12897, 14366, 14749, 14750, 9685, 14548, 16946
// Verified working: #19608 Shares, #14549 Reposts
const DEFAULT_MAPPINGS = [
  { metricType: 'VIEWS',     serviceId: '11610', costPer1000: 0.0016, minQuantity: 100 }, // 12897 BLACKLISTED
  { metricType: 'LIKES',     serviceId: '18302', costPer1000: 0.0100, minQuantity: 10  }, // 14749/14750 BLACKLISTED
  { metricType: 'SAVES',     serviceId: '17065', costPer1000: 0.0392, minQuantity: 10  }, // 14548/9685 BLACKLISTED
  { metricType: 'SHARES',    serviceId: '19608', costPer1000: 0.0010, minQuantity: 10  }, // VERIFIED WORKING
  { metricType: 'REPOSTS',   serviceId: '14549', costPer1000: 0.2938, minQuantity: 1   }, // VERIFIED WORKING
  { metricType: 'COMMENTS',  serviceId: '18803', costPer1000: 0.3000, minQuantity: 10  }, // 16946 BLACKLISTED
  { metricType: 'FOLLOWERS', serviceId: '18302', costPer1000: 0.1814, minQuantity: 10  },
];

async function ensureOfficialProvider() {
  console.log('--- Initializing Official SMM Provider ---');

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
        isActive: true,
      },
      create: {
        providerId: provider.id,
        metricType: m.metricType,
        serviceId: m.serviceId,
        costPer1000: m.costPer1000,
        isActive: true,
      },
    });
    console.log(`  Mapped ${m.metricType} -> Service ID #${m.serviceId} ($${m.costPer1000}/1k)`);
  }

  console.log('--- Official SMM Provider initialized successfully! ---');
  return provider;
}

ensureOfficialProvider()
  .catch((err) => {
    console.error('Error seeding provider:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
