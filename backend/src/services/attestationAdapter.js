import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class EasAttestationAdapter {
  async fetchAttestations(subjectWallet) {
    const list = await prisma.attestation.findMany({
      where: subjectWallet ? { subjectWallet } : {}
    });

    return list.map(item => {
      let type = "IDENTITY";
      const schemaUpper = (item.schema || "").toUpperCase();
      if (schemaUpper.includes("KYC") || schemaUpper.includes("PASSPORT") || schemaUpper.includes("IDENTITY")) {
        type = "IDENTITY";
      } else if (schemaUpper.includes("MERCHANT") || schemaUpper.includes("STORE")) {
        type = "MERCHANT";
      } else if (schemaUpper.includes("BUSINESS") || schemaUpper.includes("REGISTRATION") || schemaUpper.includes("LLC")) {
        type = "BUSINESS";
      } else if (schemaUpper.includes("COMPLIANCE") || schemaUpper.includes("AML") || schemaUpper.includes("SANCTION")) {
        type = "COMPLIANCE";
      }

      return {
        id: item.id,
        provider: "Ethereum Attestation Service (EAS)",
        issuer: item.issuer,
        schema: item.schema,
        timestamp: item.timestamp,
        status: item.status === "Active" ? "Verified" : "Revoked",
        type,
        details: item.details || "N/A"
      };
    });
  }
}

export class DojangAttestationAdapter {
  async fetchAttestations(subjectWallet) {
    // Query database for Dojang attestations
    const dbList = await prisma.attestation.findMany({
      where: {
        AND: [
          subjectWallet ? { subjectWallet: { equals: subjectWallet, mode: 'insensitive' } } : {},
          {
            OR: [
              { issuer: { startsWith: 'did:dojang', mode: 'insensitive' } },
              { schema: { startsWith: 'Dojang', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (dbList.length > 0) {
      return dbList.map(item => {
        let type = "IDENTITY";
        const schemaUpper = (item.schema || "").toUpperCase();
        if (schemaUpper.includes("KYC") || schemaUpper.includes("PASSPORT") || schemaUpper.includes("IDENTITY") || schemaUpper.includes("NATION-ID")) {
          type = "IDENTITY";
        } else if (schemaUpper.includes("MERCHANT") || schemaUpper.includes("STORE") || schemaUpper.includes("LICENSE")) {
          type = "MERCHANT";
        } else if (schemaUpper.includes("BUSINESS") || schemaUpper.includes("REGISTRATION") || schemaUpper.includes("INCORPORATION")) {
          type = "BUSINESS";
        } else if (schemaUpper.includes("COMPLIANCE") || schemaUpper.includes("AML") || schemaUpper.includes("SANCTION")) {
          type = "COMPLIANCE";
        }

        return {
          id: item.id,
          provider: "Dojang Attestation Provider",
          issuer: item.issuer,
          schema: item.schema,
          timestamp: item.timestamp,
          status: item.status === "Active" ? "Verified" : "Revoked",
          type,
          details: typeof item.details === 'string' ? item.details : JSON.stringify(item.details)
        };
      });
    }

    // Default seed credentials fallback
    const mockDojangData = [
      {
        id: "dojang-att-001",
        issuer: "did:dojang:government-registry",
        schema: "Dojang-Nation-ID",
        timestamp: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        status: "Active",
        details: JSON.stringify({ nation: "KR", liveness: "Passed" }),
        type: "IDENTITY"
      },
      {
        id: "dojang-att-002",
        issuer: "did:dojang:merchant-registry",
        schema: "Dojang-Merchant-License",
        timestamp: new Date(Date.now() - 15 * 24 * 3600 * 1000),
        status: "Active",
        details: JSON.stringify({ licenseId: "LIC-88291", successRateThreshold: "Passed" }),
        type: "MERCHANT"
      },
      {
        id: "dojang-att-003",
        issuer: "did:dojang:business-chamber",
        schema: "Dojang-Business-Incorporation",
        timestamp: new Date(Date.now() - 60 * 24 * 3600 * 1000),
        status: "Active",
        details: JSON.stringify({ entity: "KorriPay LLC", jurisdiction: "Seoul" }),
        type: "BUSINESS"
      },
      {
        id: "dojang-att-004",
        issuer: "did:dojang:compliance-authority",
        schema: "Dojang-AML-Passport",
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000),
        status: "Active",
        details: JSON.stringify({ riskScore: "Low", complianceCheck: "Passed" }),
        type: "COMPLIANCE"
      }
    ];

    return mockDojangData.map(item => ({
      id: item.id,
      provider: "Dojang Attestation Provider",
      issuer: item.issuer,
      schema: item.schema,
      timestamp: item.timestamp,
      status: item.status === "Active" ? "Verified" : "Revoked",
      type: item.type,
      details: item.details
    }));
  }
}

export class AttestationAggregator {
  constructor() {
    this.adapters = [
      new EasAttestationAdapter(),
      new DojangAttestationAdapter()
    ];
  }

  async getAllAttestations(subjectWallet) {
    const results = await Promise.all(
      this.adapters.map(adapter => 
        adapter.fetchAttestations(subjectWallet).catch(err => {
          console.error(`[AttestationAggregator] Error in adapter:`, err.message);
          return [];
        })
      )
    );
    return results.flat();
  }
}

export const attestationAggregator = new AttestationAggregator();
