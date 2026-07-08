/**
 * Bank config — shared list of banks used by the Loan Management module.
 * Each bank has a name + branch code and any number of contact people
 * (name, phone, additional info). Populated only through the Settings →
 * Bank Config UI; starts empty.
 *
 * Same subscribe/emit pattern as loanStore so components stay in sync
 * after any mutation.
 */
import { useEffect, useState } from 'react';

let state = {
  BANKS: [], // { id, name, branchCode, contacts: [{ id, name, phone, info }] }
  BANK_SEQ: 1,
  CONTACT_SEQ: 1,
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useBankStore() {
  const [, setV] = useState(0);
  useEffect(() => subscribe(() => setV((v) => v + 1)), []);
  return state;
}

const nextBankId = () => 'BNK-' + String(state.BANK_SEQ++).padStart(3, '0');
const nextContactId = () => 'BCN-' + String(state.CONTACT_SEQ++).padStart(4, '0');

/**
 * Normalise a raw contacts array coming from the form. Strips completely
 * empty rows so a "Save" with a stray blank sub-row still succeeds.
 */
function normaliseContacts(contacts) {
  return (contacts || [])
    .filter((c) => (c.name || '').trim() || (c.phone || '').trim() || (c.info || '').trim())
    .map((c) => ({
      id: c.id || nextContactId(),
      name: (c.name || '').trim(),
      phone: (c.phone || '').trim(),
      info: (c.info || '').trim(),
    }));
}

export function addBank(obj) {
  const created = {
    id: nextBankId(),
    name: (obj.name || '').trim(),
    branchCode: (obj.branchCode || '').trim(),
    contacts: normaliseContacts(obj.contacts),
  };
  state.BANKS.push(created);
  emit();
  return created;
}

export function updateBank(id, patch) {
  const b = state.BANKS.find((x) => x.id === id);
  if (!b) return;
  if (patch.name !== undefined) b.name = (patch.name || '').trim();
  if (patch.branchCode !== undefined) b.branchCode = (patch.branchCode || '').trim();
  if (patch.contacts !== undefined) b.contacts = normaliseContacts(patch.contacts);
  emit();
}

export function deleteBank(id) {
  state.BANKS = state.BANKS.filter((b) => b.id !== id);
  emit();
}

/** Human-readable label used by dropdowns in Loan Management. */
export const bankLabel = (b) => b
  ? `${b.name}${b.branchCode ? ` — ${b.branchCode}` : ''}`
  : '';
