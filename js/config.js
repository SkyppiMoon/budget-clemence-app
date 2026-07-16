/**
 * Configuration publique Supabase.
 * Ces valeurs peuvent être exposées côté navigateur : la sécurité repose sur
 * les politiques RLS définies dans sql/database.sql.
 */
export const SUPABASE_URL = 'https://VOTRE-PROJET.supabase.co';
export const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_SUPABASE';

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('VOTRE-PROJET') &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes('VOTRE_CLE');
