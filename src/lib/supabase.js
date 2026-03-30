import { createClient } from '@supabase/supabase-js'

// ⚙️  Troque pelos valores do seu projeto:
//     Supabase Dashboard → Settings → API
const SUPABASE_URL      = 'https://rwikzyvwlihvrmnfqqbd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oL8MeexzdcgLOE08-PnaqQ_dDGYpZC9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
