import { adminClient } from './supabase';
import { error } from './helpers';
import { isAtLeast } from '$lib/permissions';
import type { TeamRole } from '$lib/permissions';
import type { AppUser } from './auth';

export interface TeamMembership {
  team_id: string;
  role: TeamRole;
  status: string;
}

export interface AppTeam {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export async function getTeamBySlug(slug: string): Promise<AppTeam> {
  const supabase = adminClient();
  const { data, error: dbError } = await supabase
    .from('teams')
    .select('*')
    .eq('slug', slug)
    .single();
  if (dbError || !data) throw error(404, 'team not found');
  return data as AppTeam;
}

export async function getTeamMembership(
  teamId: string,
  userId: string
): Promise<TeamMembership | null> {
  const supabase = adminClient();
  const { data } = await supabase
    .from('team_members')
    .select('team_id, role, status')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();
  return data as TeamMembership | null;
}

export async function requireTeamRole(
  team: AppTeam,
  user: AppUser,
  minRole: TeamRole
): Promise<TeamMembership> {
  const membership = await getTeamMembership(team.id, user.id);
  if (!membership || membership.status !== 'active') throw error(403, 'not a team member');
  if (!isAtLeast(membership.role as TeamRole, minRole)) throw error(403, 'insufficient role');
  return membership;
}
