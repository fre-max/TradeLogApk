import { createClient } from '@supabase/supabase-js'

// Utilise des valeurs par défaut pour éviter le crash de l'application
// si le fichier .env n'est pas encore configuré
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder-url.supabase.co'
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

