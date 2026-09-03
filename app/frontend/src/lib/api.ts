import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const isAbsolute = /^https?:\/\//.test(path);
  const url = isAbsolute ? path : `${API_BASE_URL}${path}`;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
