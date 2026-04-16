import { createClient } from '@supabase/supabase-js';

(async () => {
  try {
    const sb = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
      window.location.replace('home/home.html');
    } else {
      window.location.replace('login/index.html');
    }
  } catch (e) {
    window.location.replace('login/index.html');
  }
})();
