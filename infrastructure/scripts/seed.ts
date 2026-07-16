import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  process.stdout.write("Database seeding initiated...\n");

  await prisma.auditLog.create({
    data: {
      action: "system_bootstrap",
      actorId: "system",
      metadata: { milestone: "M1" },
    },
  });

  process.stdout.write("Database seeding completed successfully.\n");
}

main()
  .catch((e) => {
    process.stderr.write(`Seeding error: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
