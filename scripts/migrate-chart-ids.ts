import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const CHART_ID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateChartId(): string {
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += CHART_ID_CHARS.charAt(Math.floor(Math.random() * CHART_ID_CHARS.length));
  }
  return result;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const patients = await prisma.patient.findMany({
      where: { chartId: null },
      select: { id: true },
    });

    console.log(`Found ${patients.length} patients without chartId`);

    const usedIds = new Set<string>();
    const existing = await prisma.patient.findMany({
      where: { chartId: { not: null } },
      select: { chartId: true },
    });
    existing.forEach((p) => {
      if (p.chartId) usedIds.add(p.chartId);
    });

    for (const patient of patients) {
      let chartId: string;
      do {
        chartId = generateChartId();
      } while (usedIds.has(chartId));
      usedIds.add(chartId);

      await prisma.patient.update({
        where: { id: patient.id },
        data: { chartId },
      });
    }

    console.log(`Updated ${patients.length} patients with chartIds`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
