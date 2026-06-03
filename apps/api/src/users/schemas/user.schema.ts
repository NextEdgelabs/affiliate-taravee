import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { UserRole, UserStatus } from "@taravee/types";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ["admin", "affiliate"], default: "affiliate" })
  role: UserRole;

  @Prop({ required: true, enum: ["active", "pending", "suspended"], default: "active" })
  status: UserStatus;
}

export const UserSchema = SchemaFactory.createForClass(User);
