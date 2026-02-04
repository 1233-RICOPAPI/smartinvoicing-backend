import { SetMetadata } from '@nestjs/common';
import { CompanyUserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CompanyUserRole[]) => SetMetadata(ROLES_KEY, roles);
