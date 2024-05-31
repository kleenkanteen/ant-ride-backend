import { createClient } from '@supabase/supabase-js'
import env from '#start/env'

const supabaseUrl = env.get('SUPABASE_URL')
const supabaseServiceKey = env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// https://supabase.com/docs/reference/javascript/introduction
export const supabase = createClient(supabaseUrl, supabaseServiceKey)
