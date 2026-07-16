import { OrganizationType, RoleType } from "@korripay/shared";
import { DomainMetrics, noopMetrics, makeCorrelationId } from "@korripay/domain";
import type { OrganizationRepository, AuditRepository } from "@korripay/database";

export interface CreateOrganizationCommand {
  name: string;
  type: OrganizationType;
  correlationId: string;
}

export interface InviteMemberCommand {
  organizationId: string;
  userId: string;
  roleId: string;
  correlationId: string;
}

export class OrganizationEngine {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly auditRepo: AuditRepository,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {}

  async createOrganization(cmd: CreateOrganizationCommand): Promise<string> {
    return this.metrics.time("org.create", { type: cmd.type }, async () => {
      if (!cmd.name?.trim()) throw new Error("Organization name is required");

      const correlationId = makeCorrelationId(cmd.correlationId);
      const org = await this.orgRepo.createOrganization(cmd.name, cmd.type);

      await this.auditRepo.log(
        "ORG_CREATED",
        "Organization",
        org.id,
        null,
        org.id,
        correlationId,
        null,
        null,
        { name: cmd.name, type: cmd.type }
      );

      this.metrics.increment("org.created", { type: cmd.type });
      return org.id;
    });
  }

  async inviteMember(cmd: InviteMemberCommand): Promise<void> {
    return this.metrics.time("org.invite_member", { org: cmd.organizationId }, async () => {
      const correlationId = makeCorrelationId(cmd.correlationId);

      const org = await this.orgRepo.findOrganizationById(cmd.organizationId);
      if (!org) throw new Error(`Organization not found: ${cmd.organizationId}`);

      await this.orgRepo.addMember(cmd.organizationId, cmd.userId, cmd.roleId);

      await this.auditRepo.log(
        "MEMBER_INVITED",
        "OrganizationMember",
        cmd.organizationId,
        cmd.userId,
        cmd.organizationId,
        correlationId,
        null,
        null,
        { userId: cmd.userId, roleId: cmd.roleId }
      );
    });
  }
  async assignRole(
    organizationId: string,
    userId: string,
    roleName: RoleType,
    _correlationId: string
  ): Promise<void> {
    const role = await this.orgRepo.findRoleByName(roleName);
    if (!role) throw new Error(`Role not found: ${roleName}`);
    await this.orgRepo.addMember(organizationId, userId, role.id);
  }

  async validateTenant(organizationId: string): Promise<boolean> {
    const org = await this.orgRepo.findOrganizationById(organizationId);
    return org !== null;
  }
}
