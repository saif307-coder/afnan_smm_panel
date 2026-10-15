import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFICIAL_PROVIDER = {
  name: 'SMM Pro Provider (Official Production)',
  apiUrl: 'https://smmproprovider.online/api/v2',
  apiKey: 'f33672c260df0b9870026508f1e176d1',
  isActive: true,
};

const DEFAULT_MAPPINGS = [
  { metricType: 'VIEWS', serviceId: '12897', costPer1000: 0.0004, minQuantity: 10 },
  { metricType: 'LIKES', serviceId: '14749', costPer1000: 0.0090, minQuantity: 10 },
  { metricType: 'SAVES', serviceId: '14548', costPer1000: 0.0392, minQuantity: 1 },
  { metricType: 'SHARES', serviceId: '19608', costPer1000: 0.0010, minQuantity: 10 },
  { metricType: 'REPOSTS', serviceId: '14549', costPer1000: 0.2938, minQuantity: 1 },
  { metricType: 'COMMENTS', serviceId: '16946', costPer1000: 0.3498, minQuantity: 10 },
  { metricType: 'FOLLOWERS', serviceId: '18302', costPer1000: 0.1814, minQuantity: 10 },
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
