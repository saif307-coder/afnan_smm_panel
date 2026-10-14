import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFICIAL_PROVIDER = {
  name: 'SMM Pro Provider (Official Production)',
  apiUrl: 'https://smmproprovider.online/api/v2',
  apiKey: 'f33672c260df0b9870026508f1e176d1',
  isActive: true,
};

const DEFAULT_MAPPINGS = [
  { metricType: 'VIEWS', serviceId: '3299', costPer1000: 0.0032 },
  { metricType: 'LIKES', serviceId: '2688', costPer1000: 0.0469 },
  { metricType: 'SAVES', serviceId: '2740', costPer1000: 0.1563 },
  { metricType: 'SHARES', serviceId: '2741', costPer1000: 0.0016 },
  { metricType: 'REPOSTS', serviceId: '2738', costPer1000: 1.1070 },
  { metricType: 'COMMENTS', serviceId: '2717', costPer1000: 0.8044 },
  { metricType: 'FOLLOWERS', serviceId: '2635', costPer1000: 1.5966 },
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

if (require.main === module) {
  ensureOfficialProvider()
    .catch((err) => {
      console.error('Error seeding provider:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
