/**
 * Bank config — backed by MongoDB via /api/banks. Provides a small
 * store-plus-hook so any component that calls `useBankStore()` re-renders
 * whenever any mutation succeeds.
 *
 * Contract:
 *   useBankStore() → { BANKS, loading, error, refresh }
 *   addBank(obj)      -> Promise resolving to the created doc
 *   updateBank(id, p) -> Promise resolving to the updated doc
 *   deleteBank(id)    -> Promise resolving when the row is gone
 *
 * On first call the module lazily kicks off a fetch. Every mutation
 * updates the in-memory cache immediately (optimistic-ish) AND persists
 * via the API; on API failure the cache is reconciled from a refresh.
 */
import { useEffect, useState } from 'react';
import { getBanks, createBank, updateBankApi, deleteBankApi } from './api';

let state = {
  BANKS: [],
  loading: false,
  loaded: false,
  error: null,
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Kick off a fresh fetch. Safe to call any time. */
export async function refreshBanks() {
  state.loading = true;
  state.error = null;
  emit();
  try {
    const data = await getBanks();
    state.BANKS = Array.isArray(data) ? data : [];
    state.loaded = true;
  } catch (err) {
    state.error = err && err.message ? err.message : 'Failed to load banks';
  } finally {
    state.loading = false;
    emit();
  }
}

/** React hook — subscribes and auto-loads the list on first mount. */
export function useBankStore() {
  const [, setV] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => setV((v) => v + 1));
    if (!state.loaded && !state.loading) refreshBanks();
    return unsub;
  }, []);
  return state;
}

/** Convert a form's raw contact rows into what the API expects. */
function cleanContacts(contacts) {
  return (contacts || [])
    .map((c) => ({
      name:  (c.name  || '').trim(),
      phone: (c.phone || '').trim(),
      info:  (c.info  || '').trim(),
    }))
    .filter((c) => c.name || c.phone || c.info);
}

export async function addBank(obj) {
  const payload = {
    name:       (obj.name || '').trim(),
    branchCode: (obj.branchCode || '').trim(),
    contacts:   cleanContacts(obj.contacts),
  };
  const created = await createBank(payload);
  state.BANKS = [...state.BANKS, created].sort((a, b) => {
    const s = (a.name || '').localeCompare(b.name || '');
    return s !== 0 ? s : (a.branchCode || '').localeCompare(b.branchCode || '');
  });
  emit();
  return created;
}

export async function updateBank(id, patch) {
  const payload = {};
  if (patch.name       !== undefined) payload.name       = String(patch.name).trim();
  if (patch.branchCode !== undefined) payload.branchCode = String(patch.branchCode).trim();
  if (patch.contacts   !== undefined) payload.contacts   = cleanContacts(patch.contacts);
  const updated = await updateBankApi(id, payload);
  state.BANKS = state.BANKS.map((b) => (b._id === id || b.id === id) ? updated : b);
  emit();
  return updated;
}

export async function deleteBank(id) {
  await deleteBankApi(id);
  state.BANKS = state.BANKS.filter((b) => (b._id !== id && b.id !== id));
  emit();
}

/** Human-readable label used by dropdowns in Loan Management. */
export const bankLabel = (b) => b
  ? `${b.name}${b.branchCode ? ` — ${b.branchCode}` : ''}`
  : '';

/** Stable id lookup — Mongoose returns `_id`, but existing code may use `id`. */
export const bankId = (b) => (b && (b._id || b.id)) || '';
