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
    .select('*')
    .eq('id', userId)
    .single();

  if (existing) {
    if (!existing.is_active) throw error(401, 'account inactive');
    return existing as AppUser;
  }

  // First login — create local profile
  const newUser: Omit<AppUser, 'created_at'> = {
    id: userId,
    email: sbUser.email ?? '',
    display_name:
      (sbUser.user_metadata?.full_name as string | undefined) ?? sbUser.email ?? '',
    roles: ['qa'],
    is_active: true
  };

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  if (insertError || !created) {
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
