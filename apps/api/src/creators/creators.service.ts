import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  AdminCreator,
  CreatorProfile as CreatorProfileDto,
  SelfReportedMetrics,
  UserStatus,
  VerificationStatus,
} from "@taravee/types";
import { Model } from "mongoose";

import {
  CreatorCollection,
  type CreatorCollectionDocument,
} from "../collections/schemas/creator-collection.schema";
import {
  generateCode,
  isReservedUsername,
  slugify,
  USERNAME_RE,
} from "../common/utils/code.util";
import {
  CreatorLink,
  type CreatorLinkDocument,
} from "../links/schemas/creator-link.schema";
import { UsersService } from "../users/users.service";
import {
  CreatorProfile,
  type CreatorProfileDocument,
} from "./schemas/creator-profile.schema";

const USERNAME_COOLDOWN_DAYS = 14;
const MAX_SLUG_HISTORY = 10;

export interface CreateCreatorInput {
  userId: string;
  displayName: string;
  instagramUsername?: string;
  youtubeChannel?: string;
  metrics?: Partial<SelfReportedMetrics>;
}

export interface AdminCreateCreatorInput {
  email: string;
  name: string;
  password?: string;
  instagramUsername?: string;
  youtubeChannel?: string;
  metrics?: Partial<SelfReportedMetrics>;
  commissionRate?: number;
  approve?: boolean;
}

@Injectable()
export class CreatorsService {
  constructor(
    @InjectModel(CreatorProfile.name)
    private readonly model: Model<CreatorProfileDocument>,
    @InjectModel(CreatorLink.name)
    private readonly links: Model<CreatorLinkDocument>,
    @InjectModel(CreatorCollection.name)
    private readonly collections: Model<CreatorCollectionDocument>,
    private readonly users: UsersService,
  ) {}

  create(input: CreateCreatorInput): Promise<CreatorProfileDocument> {
    return this.model.create({
      userId: input.userId,
      displayName: input.displayName,
      instagramUsername: input.instagramUsername,
      youtubeChannel: input.youtubeChannel,
      metrics: input.metrics ?? {},
    });
  }

  findByUserId(userId: string): Promise<CreatorProfileDocument | null> {
    return this.model.findOne({ userId }).exec();
  }

  /**
   * Admin creates a creator directly: either a brand-new User+CreatorProfile, or
   * — if a User with that email already exists but has NO profile — heals that
   * orphan by creating its profile. Atomic: a freshly-created User is rolled back
   * if the profile write fails. Optionally approves (mints refCode + commission).
   * Returns the AdminCreator row + a one-time temp password when auto-generated.
   */
  async createByAdmin(
    input: AdminCreateCreatorInput,
    reviewerId: string,
  ): Promise<{ creator: AdminCreator; tempPassword?: string }> {
    const email = input.email.toLowerCase().trim();
    let user = await this.users.findByEmail(email);
    let createdUser = false;
    let tempPassword: string | undefined;

    if (user) {
      if (user.role !== "affiliate") {
        throw new ConflictException("That email belongs to a non-creator account.");
      }
      if (await this.findByUserId(user._id.toString())) {
        throw new ConflictException("A creator with that email already exists.");
      }
    } else {
      const password = input.password ?? (tempPassword = generateCode(12));
      user = await this.users.create({
        email,
        password,
        name: input.name,
        role: "affiliate",
        status: input.approve ? "active" : "pending",
      });
      createdUser = true;
    }

    const uid = user._id.toString();
    let profile: CreatorProfileDocument;
    try {
      profile = await this.create({
        userId: uid,
        displayName: input.name,
        instagramUsername: input.instagramUsername?.replace(/^@/, ""),
        youtubeChannel: input.youtubeChannel,
        metrics: input.metrics,
      });
    } catch (err) {
      if (createdUser) await this.users.deleteById(uid).catch(() => undefined);
      throw err;
    }

    if (input.approve) {
      profile = await this.approve(profile._id.toString(), reviewerId, input.commissionRate ?? 0.1);
    } else if (typeof input.commissionRate === "number") {
      profile.commissionRate = input.commissionRate;
      await profile.save();
    }

    const u = await this.users.findById(uid);
    const creator: AdminCreator = {
      ...this.toProfile(profile),
      email: u?.email ?? email,
      name: u?.name ?? input.name,
      status: (u?.status ?? "pending") as UserStatus,
      rejectionReason: profile.rejectionReason,
    };
    return { creator, tempPassword };
  }

  findByRefCode(refCode: string): Promise<CreatorProfileDocument | null> {
    return this.model.findOne({ refCode }).exec();
  }

  /** Resolve by current slug first; fall back to a historical slug so old links
   *  still resolve (the caller 301s to the canonical current slug). */
  async findBySlug(slug: string): Promise<CreatorProfileDocument | null> {
    return (
      (await this.model.findOne({ slug }).exec()) ??
      (await this.model.findOne({ slugHistory: slug }).exec())
    );
  }

  /** Creator self-service username change. Idempotent ordered writes (no txn):
   *  set slug (unique index is the guard) → push old to history → re-sync the
   *  denormalized creatorSlug on links + collections. */
  async updateUsername(userId: string, raw: string): Promise<CreatorProfileDto> {
    const next = raw.normalize("NFKC").toLowerCase().trim();
    if (!USERNAME_RE.test(next)) {
      throw new BadRequestException(
        "Username must be 3–40 chars: lowercase letters, numbers and hyphens (no leading/trailing hyphen).",
      );
    }
    if (isReservedUsername(next)) throw new ConflictException("That username is reserved.");

    const profile = await this.model.findOne({ userId }).exec();
    if (!profile) throw new NotFoundException("Creator not found");
    if (profile.slug === next) return this.toProfile(profile); // no-op

    if (profile.usernameChangedAt) {
      const days = (Date.now() - profile.usernameChangedAt.getTime()) / 86_400_000;
      if (days < USERNAME_COOLDOWN_DAYS) {
        throw new BadRequestException(
          `You can change your username again in ${Math.ceil(USERNAME_COOLDOWN_DAYS - days)} day(s).`,
        );
      }
    }
    if (await this.model.exists({ slug: next, _id: { $ne: profile._id } })) {
      throw new ConflictException("That username is already taken.");
    }

    const old = profile.slug;
    profile.slug = next;
    if (old) {
      profile.slugHistory = [
        ...(profile.slugHistory ?? []).filter((s) => s !== next),
        old,
      ].slice(-MAX_SLUG_HISTORY);
    }
    profile.usernameChangedAt = new Date();
    try {
      await profile.save();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException("That username is already taken.");
      }
      throw e;
    }
    // Re-sync denormalized slug so newly-rendered publicUrls point at the new name.
    if (old) {
      await this.links.updateMany({ creatorId: profile.userId }, { $set: { creatorSlug: next } });
      await this.collections.updateMany(
        { creatorId: profile.userId },
        { $set: { creatorSlug: next } },
      );
    }
    return this.toProfile(profile);
  }

  count(status?: VerificationStatus): Promise<number> {
    return this.model
      .countDocuments(status ? { verificationStatus: status } : {})
      .exec();
  }

  async list(status?: VerificationStatus): Promise<AdminCreator[]> {
    const filter = status ? { verificationStatus: status } : {};
    const profiles = await this.model.find(filter).sort({ createdAt: -1 }).exec();
    const users = await this.users.findByIds(profiles.map((p) => p.userId));
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    return profiles.map((p) => {
      const u = byId.get(p.userId.toString());
      return {
        ...this.toProfile(p),
        email: u?.email ?? "",
        name: u?.name ?? p.displayName,
        status: (u?.status ?? "pending") as UserStatus,
        rejectionReason: p.rejectionReason,
      };
    });
  }

  async approve(
    id: string,
    reviewerId: string,
    commissionRate?: number,
  ): Promise<CreatorProfileDocument> {
    const profile = await this.model.findById(id).exec();
    if (!profile) throw new NotFoundException("Creator not found");

    if (!profile.refCode) profile.refCode = await this.mintRefCode();
    if (!profile.slug) profile.slug = await this.mintSlug(profile.displayName);
    profile.verificationStatus = "approved";
    profile.reviewedBy = reviewerId as never;
    profile.reviewedAt = new Date();
    profile.rejectionReason = undefined;
    if (typeof commissionRate === "number") profile.commissionRate = commissionRate;
    await profile.save();

    await this.users.updateStatus(profile.userId.toString(), "active");
    return profile;
  }

  async reject(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<CreatorProfileDocument> {
    const profile = await this.model.findById(id).exec();
    if (!profile) throw new NotFoundException("Creator not found");
    profile.verificationStatus = "rejected";
    profile.reviewedBy = reviewerId as never;
    profile.reviewedAt = new Date();
    profile.rejectionReason = reason;
    await profile.save();
    await this.users.updateStatus(profile.userId.toString(), "suspended");
    return profile;
  }

  async setCommission(id: string, rate: number): Promise<CreatorProfileDocument> {
    const profile = await this.model.findByIdAndUpdate(
      id,
      { commissionRate: rate },
      { new: true },
    );
    if (!profile) throw new NotFoundException("Creator not found");
    return profile;
  }

  async setStatus(id: string, status: UserStatus): Promise<void> {
    const profile = await this.model.findById(id).exec();
    if (!profile) throw new NotFoundException("Creator not found");
    await this.users.updateStatus(profile.userId.toString(), status);
  }

  async setPayout(
    userId: string,
    payout: CreatorProfileDto["payout"],
  ): Promise<CreatorProfileDocument> {
    const profile = await this.model.findOneAndUpdate(
      { userId },
      { payout: payout ?? {} },
      { new: true },
    );
    if (!profile) throw new NotFoundException("Creator not found");
    return profile;
  }

  private async mintRefCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateCode(8);
      if (!(await this.model.exists({ refCode: code }))) return code;
    }
    return generateCode(12);
  }

  private async mintSlug(displayName: string): Promise<string> {
    let base = slugify(displayName);
    // Pad too-short or reserved bases so they never become a bare reserved/short slug.
    if (base.length < 3 || isReservedUsername(base)) base = `${base || "creator"}-store`;
    // A reserved base ("admin", "taravee", …) must NEVER persist as the slug, and
    // it must never throw at approval — fall through to a unique suffixed value.
    if (!isReservedUsername(base) && !(await this.model.exists({ slug: base }))) return base;
    for (let i = 0; i < 5; i++) {
      const candidate = `${base}-${generateCode(4)}`;
      if (!isReservedUsername(candidate) && !(await this.model.exists({ slug: candidate }))) {
        return candidate;
      }
    }
    return `creator-${generateCode(8)}`;
  }

  toProfile(doc: CreatorProfileDocument): CreatorProfileDto {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      refCode: doc.refCode ?? "",
      slug: doc.slug ?? "",
      displayName: doc.displayName,
      instagramUsername: doc.instagramUsername,
      youtubeChannel: doc.youtubeChannel,
      metrics: {
        igFollowers: doc.metrics?.igFollowers ?? 0,
        igAvgViews: doc.metrics?.igAvgViews ?? 0,
        ytSubscribers: doc.metrics?.ytSubscribers ?? 0,
        ytAvgViews: doc.metrics?.ytAvgViews ?? 0,
      },
      verificationStatus: doc.verificationStatus,
      commissionRate: doc.commissionRate,
      theme: doc.theme,
      payout: {
        upiId: doc.payout?.upiId,
        accountName: doc.payout?.accountName,
        bankAccount: doc.payout?.bankAccount,
        bankIfsc: doc.payout?.bankIfsc,
      },
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }
}
