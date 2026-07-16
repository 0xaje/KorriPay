import { BaseRepository } from "./base.js";
import { InfrastructureError } from "@korripay/errors";

export class AuditRepository extends BaseRepository {
  async log(
    event: string,
    entity: string,
    entityId: string,
    userId: string | null,
    organizationId: string | null,
    correlationId: string,
    ipAddress: string | null,
    beforeState: any,
    afterState: any
  ) {
    const content = JSON.stringify({
      event,
      entity,
      entityId,
      userId,
      organizationId,
      correlationId,
      ipAddress,
      beforeState,
      afterState,
    });

    const hash = Buffer.from(content).toString("base64").substring(0, 64);

    return this.prisma.auditLog.create({
      data: {
        event,
        entity,
        entityId,
        userId,
        organizationId,
        correlationId,
        ipAddress,
        beforeState,
        afterState,
        hash,
      },
    });
  }

  // Audits are append-only
  async updateAuditLog() {
    throw new InfrastructureError("Audit logs are append-only: Updates are strictly prohibited");
  }

  async deleteAuditLog() {
    throw new InfrastructureError("Audit logs are append-only: Deletes are strictly prohibited");
  }

  // Native Domain Event Store
  async saveDomainEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: any,
    correlationId: string,
    version = 1
  ) {
    return this.prisma.domainEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload,
        correlationId,
        version,
      },
    });
  }

  async findDomainEvents(aggregateType: string, aggregateId: string) {
    return this.prisma.domainEvent.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { timestamp: "asc" },
    });
  }
}
