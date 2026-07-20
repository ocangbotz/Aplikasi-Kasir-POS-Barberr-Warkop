/**
 * auth.js — sesi login sisi client: simpan/pulihkan token & user, guard role.
 */

import { apiCall } from './api.js';
import { STORAGE_KEYS } from './config.js';
import { setState, getState } from './state.js';

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || null;
}

export function getCurrentUser() {
  return getState('currentUser');
}

export async function login(username, password) {
  const data = await apiCall('auth.login', { username, password });
  localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
  setState('currentUser', data.user);
  return data.user;
}

export async function logout() {
  try {
    await apiCall('auth.logout', {});
  } catch (e) {
    // Tetap logout secara lokal walau request logout ke server gagal (mis. offline).
  }
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  setState('currentUser', null);
}

/** Dipanggil sekali saat app.js boot: pulihkan sesi dari localStorage tanpa perlu login ulang. */
export function restoreSessionFromStorage() {
  const token = getToken();
  const userRaw = localStorage.getItem(STORAGE_KEYS.USER);
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    setState('currentUser', user);
    return user;
  } catch (e) {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    return null;
  }
}

/** Murni: cek apakah user (bisa null) punya salah satu role yang diizinkan. */
export function hasRole(user, allowedRoles) {
  return !!user && Array.isArray(allowedRoles) && allowedRoles.indexOf(user.role) !== -1;
}
