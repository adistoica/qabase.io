import { adminClient } from './supabase';
import { error } from './helpers';

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
  is_active: boolean;
  created_at: string;
}

export async function getAuthUser(request: Request): Promise<AppUser> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw error(401, 'not authenticated');
  }
  const token = authHeader.slice(7).trim();
  const supabase = adminClient();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    throw error(401, 'invalid token');
  }

  const sbUser = authData.user;
  const userId = sbUser.id;

  const { data: existing } = await supabase
    .from('users')
    .select('id, email, display_name, roles, is_active, created_at')
    .eq('id', userId)
    .single();

  if (existing) {
    if (!existing.is_active) throw error(401, 'account inactive');
    return existing as AppUser;
  }

  // First login — create local profile
  const email = sbUser.email ?? '';
  if (!email) throw error(400, 'email address required');

  const { data: pendingInvite } = await supabase
    .from('team_invitations')
    .select('id')
    .eq('status', 'pending')
    .ilike('email', email)
    .limit(1)
    .single();

  // Only the very first user in the system gets owner; subsequent uninvited
  // signups get no global roles and must be granted access explicitly.
  // Note: two concurrent first-time signups could both read count=0 and both
  // receive owner. A DB-level unique constraint on the owner role is the proper
  // guard; this code handles the more common same-user concurrent login race below.
  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
  const isFirstUser = (userCount ?? 0) === 0;

  const newUser: Omit<AppUser, 'created_at'> = {
    id: userId,
    email,
    display_name:
      (sbUser.user_metadata?.full_name as string | undefined) ?? email,
    roles: isFirstUser ? ['owner'] : pendingInvite ? ['qa'] : [],
    is_active: true
  };

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  if (insertError || !created) {
    // Another concurrent login for the same user may have inserted the row first.
    const { data: raced } = await supabase
      .from('users')
      .select('id, email, display_name, roles, is_active, created_at')
      .eq('id', userId)
      .single();
    if (raced) {
      if (!raced.is_active) throw error(401, 'account inactive');
      return raced as AppUser;
    }
    throw error(500, 'failed to create user profile');
  }

  return created as AppUser;
}

export async function getOptionalUser(request: Request): Promise<AppUser | null> {
  if (!request.headers.get('Authorization')) return null;
  try {
    return await getAuthUser(request);
  } catch {
    return null;
  }
}
