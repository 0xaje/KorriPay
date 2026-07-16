import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  process.stdout.write("Seeding canonical Roles...\n");
  const roles = [
    { name: "SUPER_ADMIN", permissions: ["*"] },
    { name: "ADMIN", permissions: ["manage_org", "manage_members"] },
    { name: "OPERATOR", permissions: ["view_settlement", "update_settlement"] },
    { name: "COMPLIANCE_OFFICER", permissions: ["review_compliance", "approve_compliance"] },
    { name: "TREASURY_MANAGER", permissions: ["manage_treasury", "execute_transaction"] },
    { name: "AUDITOR", permissions: ["view_audit_logs"] },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name as any },
      update: { permissions: role.permissions },
      create: { name: role.name as any, permissions: role.permissions },
    });
  }

  process.stdout.write("Seeding sample Organization...\n");
  const organization = await prisma.organization.create({
    data: {
      name: "KorriPay Institutional Bank",
      type: "FINANCIAL_INSTITUTION",
    },
  });

  process.stdout.write("Seeding Admin User...\n");
  const user = await prisma.user.create({
    data: {
      email: "admin@korripay.com",
      passwordHash: "$2b$12$K89c894c7v101v010c710c7v89bc8923v1bc7v0897v089cv",
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "SUPER_ADMIN" },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  process.stdout.write("Seeding Treasury Account...\n");
  const treasuryAccount = await prisma.treasuryAccount.create({
    data: {
      organizationId: organization.id,
      name: "Main Clearing Treasury",
      type: "SETTLEMENT",
      currency: "USD",
    },
  });

  process.stdout.write("Seeding Liquidity Pool...\n");
  const liquidityPool = await prisma.liquidityPool.create({
    data: {
      organizationId: organization.id,
      name: "USDC Liquidity Pool",
      currency: "USD",
      balance: 1000000.0,
    },
  });

  process.stdout.write("Seeding Reserve Allocation...\n");
  await prisma.reserveAllocation.create({
    data: {
      organizationId: organization.id,
      poolId: liquidityPool.id,
      accountId: treasuryAccount.id,
      amount: 500000.0,
    },
  });

  process.stdout.write("Seeding Sample Compliance Rules...\n");
  const rules = [
    {
      name: "Max Transaction Limit",
      description: "Flag transactions above 10,000 USD",
      parameters: { limit: 10000 },
    },
    {
      name: "Sanctions Check",
      description: "Validate sender against global OFAC lists",
      parameters: { lists: ["OFAC", "EU"] },
    },
  ];

  for (const rule of rules) {
    await prisma.complianceRule.create({
      data: {
        organizationId: organization.id,
        name: rule.name,
        description: rule.description,
        parameters: rule.parameters,
      },
    });
  }

  process.stdout.write("Seeding Sample Country Policies...\n");
  const policies = [
    { countryCode: "US", blocked: false, rules: { kycRequired: true } },
    { countryCode: "KP", blocked: true, rules: { reason: "OFAC Sanction" } },
  ];

  for (const policy of policies) {
    await prisma.countryPolicy.create({
      data: {
        countryCode: policy.countryCode,
        blocked: policy.blocked,
        rules: policy.rules,
      },
    });
  }

  process.stdout.write("Seeding Sample API Key...\n");
  await prisma.apiKey.create({
    data: {
      organizationId: organization.id,
      name: "Production Gateway API Key",
      keyHash: "6bc8923v1bc7v0897v089cv6bc8923v1bc7v0897v089cv",
    },
  });

  process.stdout.write("Seeding Sample Identity Profile...\n");
  await prisma.identityProfile.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      kycLevel: "LEVEL_3",
      documentHash: "0x89abcf89bc8923v1bc7v0897v089cv",
    },
  });

  process.stdout.write("Seed completed successfully!\n");
}

main()
  .catch((e) => {
    process.stderr.write(`Seeding failed: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
