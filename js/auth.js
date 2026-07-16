import { supabase } from './supabase.js';

/**
 * Retourne la session Supabase actuellement enregistrée.
 */
export async function getCurrentSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

/**
 * Connecte l’utilisateur avec son adresse e-mail et son mot de passe.
 */
export async function signInWithPassword(email, password) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw error;
  }

  return data.session;
}

/**
 * Déconnecte l’utilisateur.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * Observe les changements de connexion et de déconnexion.
 */
export function observeAuthChanges(callback) {
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session);
    }
  );

  return subscription;
}
