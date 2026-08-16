import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true }
});

export async function upsertKeyMeta(keyName: string, provider: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('keys_meta')
    .upsert(
      {
        user_id: user.id,
        key_name: keyName,
        provider,
        last_used: null
      },
      { onConflict: 'user_id,key_name' }
    )
    .select()
    .single();

  if (error) {
    console.warn('upsertKeyMeta', error.message);
    return null;
  }
  return data;
}

export async function fetchUsageEvents(limit = 200) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('usage_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('fetchUsageEvents', error.message);
    return [];
  }
  return data || [];
}

export async function fetchKeysMeta() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('keys_meta')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchKeysMeta', error.message);
    return [];
  }
  return data || [];
}
