// src/lib/supabaseServerClient.ts
import { createClient } from '@supabase/supabase-js';

const url    = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient(url, serviceKey, {
  // no auth helpers here—just raw SQL access
});
