<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  onMount(async () => {
    // PKCE flow: Supabase puts a one-time `code` in the query string
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      window.location.href = error ? '/login' : '/';
      return;
    }

    // Implicit flow: tokens are in the URL hash, Supabase processes them
    // automatically — just wait for SIGNED_IN before redirecting
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        window.location.href = '/';
      }
    });

    return () => subscription.unsubscribe();
  });
</script>

<div class="min-h-screen grid place-items-center">
  <p class="text-sm text-[var(--color-muted-foreground)]">Redirecting…</p>
</div>
