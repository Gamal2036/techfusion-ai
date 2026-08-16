import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ACC-FOUND-01 — Account profile summary.
 *
 * The account summary surface exposes only the authenticated user's own safe
 * profile fields (id, email, displayName, createdAt, updatedAt). Identity is
 * derived exclusively from the authenticated server context (req.user.sub) —
 * never from a body/query userId. Credential material (passwordHash,
 * mfaSecret, mfaBackupCodes) and SSO identity fields are never selected and
 * therefore never leave the endpoint. No schema change is required: every
 * returned field already exists on the User model.
 */
export interface AccountProfileSummary {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const PROFILE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AccountProfileService {
  constructor(private prisma: PrismaService) {}

  /** GET /auth/account/summary — self-scoped safe profile fields. */
  async getSummary(userId: string): Promise<AccountProfileSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) {
      // The membership-authoritative guard normally rejects before this point;
      // this is a defensive answer for a raced call against a deleted account.
      throw new NotFoundException('Account not found');
    }
    return user;
  }

  /** PATCH /auth/account/summary — self-scoped display-name update. */
  async updateDisplayName(userId: string, displayName: string): Promise<AccountProfileSummary> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: displayName.trim() },
      select: PROFILE_SELECT,
    });
    return user;
  }
}
