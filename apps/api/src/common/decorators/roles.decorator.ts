import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@taravee/types";

export const ROLES_KEY = "roles";

/** Restrict a route to one or more roles. Used together with RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
