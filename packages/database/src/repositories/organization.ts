import { BaseRepository } from "./base.js";
import { OrganizationType } from "@korripay/shared";

export class OrganizationRepository extends BaseRepository {
  async createOrganization(name: string, type: OrganizationType) {
    return this.prisma.organization.create({
      data: { name, type },
    });
  }

  async findOrganizationById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });
  }

  async createUser(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: { email, passwordHash },
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async addMember(organizationId: string, userId: string, roleId: string) {
    return this.prisma.organizationMember.create({
      data: { organizationId, userId, roleId },
    });
  }

  async findRoleByName(name: any) {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  async createApiKey(organizationId: string, name: string, keyHash: string, expiresAt?: Date) {
    return this.prisma.apiKey.create({
      data: { organizationId, name, keyHash, expiresAt },
    });
  }

  async validateApiKey(keyHash: string) {
    return this.prisma.apiKey.findUnique({
      where: { keyHash, isActive: true },
      include: { organization: true },
    });
  }
}
