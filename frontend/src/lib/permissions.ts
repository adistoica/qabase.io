export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4, admin: 3, member: 2, viewer: 1
};

export function isAtLeast(userRole: TeamRole, required: TeamRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}

export function canManageMembers(role: TeamRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}

export function canManageProjects(role: TeamRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['member'];
}

export function canViewOnly(role: TeamRole): boolean {
  return role === 'viewer';
}
