const PDC = require('../models/PDC');
const BankAccount = require('../models/BankAccount');
const Party = require('../models/Party');
const Branch = require('../models/Branch');

// ── PDC CRUD ────────────────────────────────────────────────────────────
const list = async (req, res) => {
  const { dir, status, custody, party, search } = req.query;
  const q = {};
  if (dir) q.dir = dir;
  if (status) q.status = status;
  if (custody) q.custody = custody;
  if (party) q.party = party;
  if (search) {
    q.$or = [
      { pdcId: new RegExp(search, 'i') },
      { cheque: new RegExp(search, 'i') },
      { party: new RegExp(search, 'i') },
      { bank: new RegExp(search, 'i') },
      { invoiceRef: new RegExp(search, 'i') },
    ];
  }
  const list = await PDC.find(q).sort({ maturity: 1 });
  res.json(list);
};

const getOne = async (req, res) => {
  const pdc = await PDC.findById(req.params.id);
  if (!pdc) return res.status(404).json({ message: 'PDC not found' });
  res.json(pdc);
};

const create = async (req, res) => {
  const body = { ...req.body };
  body.timeline = [{ event: 'Created', desc: `Lodged by ${req.user?.name || 'system'}`, user: req.user?.name || 'system' }];
  const pdc = await PDC.create(body);
  res.status(201).json(pdc);
};

const update = async (req, res) => {
  const cur = await PDC.findById(req.params.id);
  if (!cur) return res.status(404).json({ message: 'PDC not found' });
  // Track status change in timeline
  if (req.body.status && req.body.status !== cur.status) {
    cur.timeline.push({ event: 'Status Change', desc: `${cur.status} → ${req.body.status}`, user: req.user?.name || 'system' });
  }
  Object.assign(cur, req.body);
  await cur.save();
  res.json(cur);
};

const remove = async (req, res) => {
  const pdc = await PDC.findByIdAndDelete(req.params.id);
  if (!pdc) return res.status(404).json({ message: 'PDC not found' });
  res.json({ message: 'PDC deleted' });
};

// PUT /api/pdc/:id/status
const changeStatus = async (req, res) => {
  const { status, reason } = req.body;
  const cur = await PDC.findById(req.params.id);
  if (!cur) return res.status(404).json({ message: 'PDC not found' });
  cur.timeline.push({ event: 'Status Change', desc: `${cur.status} → ${status}${reason ? ' (' + reason + ')' : ''}`, user: req.user?.name || 'system' });
  cur.status = status;
  if (status === 'Bounced') {
    cur.bounce = { ...(cur.bounce || {}), bounceDate: new Date().toISOString().slice(0, 10), returnReason: reason || '' };
  }
  await cur.save();
  res.json(cur);
};

// Dashboard aggregates
const dashboard = async (req, res) => {
  const all = await PDC.find();
  const today = new Date();
  const dayDiff = (d) => Math.round((new Date(d) - today) / (1000 * 60 * 60 * 24));

  const inwardCustody = all.filter(p => p.dir === 'IN' && p.status === 'In Custody');
  const outwardIssued = all.filter(p => p.dir === 'OUT' && p.status === 'In Custody');
  const dueWeek = all.filter(p => {
    const d = dayDiff(p.maturity);
    return d >= 0 && d <= 7 && !['Cleared', 'Cancelled'].includes(p.status);
  });
  const overdue = all.filter(p => dayDiff(p.maturity) < 0 && !['Cleared', 'Bounced', 'Cancelled'].includes(p.status));
  const bounced = all.filter(p => p.status === 'Bounced');
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const clearedMtd = all.filter(p => p.status === 'Cleared' && new Date(p.updatedAt) >= monthStart);

  const sum = (arr) => arr.reduce((s, p) => s + (p.amount || 0), 0);

  res.json({
    inward: { sum: sum(inwardCustody), count: inwardCustody.length },
    outward: { sum: sum(outwardIssued), count: outwardIssued.length },
    dueWeek: { sum: sum(dueWeek), count: dueWeek.length },
    overdue: { count: overdue.length },
    bounced: { sum: sum(bounced), count: bounced.length },
    clearedMtd: { sum: sum(clearedMtd), count: clearedMtd.length },
  });
};

// ── Bank Accounts CRUD ──────────────────────────────────────────────────
const listBankAccounts = async (req, res) => res.json(await BankAccount.find().sort({ nick: 1 }));
const createBankAccount = async (req, res) => {
  try { const a = await BankAccount.create(req.body); res.status(201).json(a); }
  catch (e) { res.status(400).json({ message: e.message }); }
};
const updateBankAccount = async (req, res) => {
  const a = await BankAccount.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!a) return res.status(404).json({ message: 'Bank account not found' });
  res.json(a);
};
const deleteBankAccount = async (req, res) => {
  const a = await BankAccount.findByIdAndDelete(req.params.id);
  if (!a) return res.status(404).json({ message: 'Bank account not found' });
  res.json({ message: 'Deleted' });
};

// ── Parties CRUD ─────────────────────────────────────────────────────────
const listParties = async (req, res) => res.json(await Party.find().sort({ name: 1 }));
const createParty = async (req, res) => {
  try { const p = await Party.create(req.body); res.status(201).json(p); }
  catch (e) { res.status(400).json({ message: e.message }); }
};
const deleteParty = async (req, res) => {
  const p = await Party.findByIdAndDelete(req.params.id);
  if (!p) return res.status(404).json({ message: 'Party not found' });
  res.json({ message: 'Deleted' });
};

// ── Branches CRUD ────────────────────────────────────────────────────────
const listBranches = async (req, res) => res.json(await Branch.find().sort({ code: 1 }));
const createBranch = async (req, res) => {
  try { const b = await Branch.create(req.body); res.status(201).json(b); }
  catch (e) { res.status(400).json({ message: e.message }); }
};
const deleteBranch = async (req, res) => {
  const b = await Branch.findByIdAndDelete(req.params.id);
  if (!b) return res.status(404).json({ message: 'Branch not found' });
  res.json({ message: 'Deleted' });
};

module.exports = {
  list, getOne, create, update, remove, changeStatus, dashboard,
  listBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  listParties, createParty, deleteParty,
  listBranches, createBranch, deleteBranch,
};
