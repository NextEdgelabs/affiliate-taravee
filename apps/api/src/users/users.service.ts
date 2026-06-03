import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { SessionUser, UserRole, UserStatus } from "@taravee/types";
import bcrypt from "bcryptjs";
import { Model, Types } from "mongoose";

import { User, type UserDocument } from "./schemas/user.schema";

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
}

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIds(ids: Types.ObjectId[] | string[]): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  async create(input: CreateUserInput): Promise<UserDocument> {
    const password = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.userModel.create({
      email: input.email,
      password,
      name: input.name,
      role: input.role ?? "affiliate",
      ...(input.status ? { status: input.status } : {}),
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  /** Used to roll back a half-created account (user with no creator profile). */
  async deleteById(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }

  comparePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  /** Strip the password and map a Mongoose document to the public shape. */
  toSessionUser(user: UserDocument): SessionUser {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }
}
