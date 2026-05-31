import type { AppUser } from './auth';
import type { AppProject } from './projects';
import { error } from './helpers';

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  qa: 1,
  manager: 2,
  admin: 3
};

export function userRolesInProject(user: AppUser, project: AppProject): string[] {
  const override = (project.role_overrides ?? {})[user.id];
  return override ?? user.roles ?? [];
}

export function hasRole(user: AppUser, project: AppProject, ...needed: string[]): boolean {
  const roles = userRolesInProject(user, project);
  if (roles.includes('admin')) return true;
  const neededSet = new Set(needed);
  return roles.some((r) => neededSet.has(r));
}

export function requireRole(
  user: AppUser,
  project: AppProject,
  ...needed: string[]
): void {
  if (!hasRole(user, project, ...needed)) {
    throw error(403, `requires one of: ${needed.join(', ')}`);
  }
}

export function requireViewer(user: AppUser, project: AppProject): void {
  requireRole(user, project, 'viewer', 'qa', 'manager', 'admin');
}

export function requireQa(user: AppUser, project: AppProject): void {
  requireRole(user, project, 'qa', 'manager', 'admin');
}

export function requireManager(user: AppUser, project: AppProject): void {
  requireRole(user, project, 'manager', 'admin');
}

export function requireAdmin(user: AppUser, project: AppProject): void {
  requireRole(user, project, 'admin');
}

export function requireSuperAdmin(user: AppUser): void {
  if (!user.roles?.includes('superadmin')) throw error(403, 'superadmin role required');
}

export { ROLE_RANK };
