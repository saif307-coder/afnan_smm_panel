import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACTIVE_PROVIDER = {
  name: 'SMM Pro Provider (Official Production)',
  apiUrl: 'https://my.smmgen.com/api/v2',
  apiKey: '1f6daf1143778ae5b33f5ba1e67c80bb',
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

const DEFAULT_SETTINGS = {
  likesPercentage: 3.4,
  savesPercentage: 2.8,
  sharesPercentage: 0.95,
  repostsPercentage: 0.35,
  commentsPercentage: 0.12,
  followsPercentage: 0.025,
  viewersPercentage: 67.5,
  avgWatchTimeRatio: 0.7,
};

async function main() {
  console.log('--- Seeding Supabase PostgreSQL Database ---');

  // 1. Seed or update Admin Settings
  const existingSettings = await prisma.adminSettings.findFirst();
  if (!existingSettings) {
    await prisma.adminSettings.create({
      data: DEFAULT_SETTINGS,
    });
    console.log('✓ Default Admin Settings created');
  } else {
    console.log('✓ Existing Admin Settings found');
  }

  // 2. Seed active SMM provider
  let provider = await prisma.smmProvider.findFirst({
    where: { apiUrl: ACTIVE_PROVIDER.apiUrl },
  });

  if (!provider) {
    provider = await prisma.smmProvider.create({
      data: ACTIVE_PROVIDER,
    });
    console.log(`✓ Active Provider created: ${provider.name} (${provider.id})`);
  } else {
    provider = await prisma.smmProvider.update({
      where: { id: provider.id },
      data: {
        name: ACTIVE_PROVIDER.name,
        apiKey: ACTIVE_PROVIDER.apiKey,
        isActive: true,
      },
    });
    console.log(`✓ Active Provider verified: ${provider.name}`);
  }

  // 3. Seed Service Mappings
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
  }
  console.log('✓ All 7 Service Mappings seeded');
  console.log('--- Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
