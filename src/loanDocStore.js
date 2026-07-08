/**
 * Loan Documents — repository indexed by bank (from Bank Config), not by
 * loan. This is what feeds the "Facility" dropdown on the Loan Documents
 * page: options come from `bankStore` and each uploaded document is
 * tagged with the picked bank's id.
 *
 * State is in-memory for now (matches the rest of LoanDesk that hasn't
 * been migrated to the API yet). Same subscribe/emit pattern as the
 * other stores so `useLoanDocStore()` re-renders on every mutation.
 */
import { useEffect, useState } from 'react';

let state = {
  DOCS: [],   // [{ id, bankId, stage, note, name, size, dataUrl, date }]
  SEQ: 1,
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getDocState = () => state;

export function useLoanDocStore() {
  const [, setV] = useState(0);
  useEffect(() => subscribe(() => setV((v) => v + 1)), []);
  return state;
}

/**
 * Read every file in `fileList` into a data-url (browser memory) and
 * append them to the store, all tagged with the same bankId/stage/note.
 * Returns a promise resolving to the number of files stored.
 */
export function attachLoanDocs(bankId, stage, fileList, note) {
  if (!bankId || !fileList || !fileList.length) return Promise.resolve(0);
  const files = Array.from(fileList);
  return Promise.all(files.map((f) => new Promise((res) => {
    const r = new FileReader();
    r.onload  = () => res({ name: f.name, size: f.size, dataUrl: r.result });
    r.onerror = () => res({ name: f.name, size: f.size, dataUrl: null });
    r.readAsDataURL(f);
  }))).then((items) => {
    const today = new Date().toISOString().slice(0, 10);
    items.forEach((it) => {
      state.DOCS.push({
        id: 'DOC-' + String(state.SEQ++).padStart(4, '0'),
        bankId, stage, note: note || '',
        name: it.name, size: it.size, dataUrl: it.dataUrl,
        date: today,
      });
    });
    emit();
    return items.length;
  });
}

export function deleteLoanDoc(id) {
  state.DOCS = state.DOCS.filter((d) => d.id !== id);
  emit();
}

/** All docs, most recent first. */
export function listLoanDocs() {
  return state.DOCS.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
}
