const AdvancePayment = require('../models/AdvancePayment');
const User = require('../models/User');

const STAGE_NAMES = ['Submitted', 'AP Approved', 'CMD Approved'];

const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Role detection (case-insensitive, lenient) ──────────────────────────
const isCMDUser = (u = {}) => {
  const r = (u.role || '').toLowerCase();
  const d = (u.dept || '').toLowerCase();
  return r.includes('cmd') || r.includes('administrator') || r === 'admin'
      || d.includes('cmd') || d.includes('management');
};
const isAPUser = (u = {}) => {
  const r = (u.role || '').toLowerCase();
  const d = (u.dept || '').toLowerCase();
  return r.includes('accountant')        // primary role label used in this app
      || r.includes('accounts payable')
      || d.includes('accounts payable')
      || d.includes('accountant')
      || r === 'ap' || d === 'ap';
};

// Older JWTs don't include `dept` — fetch the full user record so role/dept
// checks are always accurate without forcing every user to re-login.
const resolveUser = async (req) => {
  if (req.user?.dept !== undefined && req.user?.role !== undefined) return req.user;
  if (!req.user?.id) return req.user || {};
  try {
    const full = await User.findById(req.user.id).lean();
    return { ...req.user, ...(full || {}) };
  } catch {
    return req.user || {};
  }
};

// ── CRUD ────────────────────────────────────────────────────────────────
const list = async (req, res) => {
  const { category, paymentType, stage, search, rejected } = req.query;
  const q = {};
  if (category && category !== 'All') q.category = category;
  if (paymentType && paymentType !== 'All') q.paymentType = paymentType;
  if (stage !== undefined && stage !== 'All') q.stageIdx = parseInt(stage, 10);
  if (rejected === 'true') q.rejected = true;
  if (rejected === 'false') q.rejected = false;
  if (search) {
    q.$or = [
      { advId: new RegExp(search, 'i') },
      { vendor: new RegExp(search, 'i') },
      { poNumber: new RegExp(search, 'i') },
      { proformaInvoice: new RegExp(search, 'i') },
    ];
  }
  const rows = await AdvancePayment.find(q).sort({ createdAt: -1 });
  res.json(rows);
};

const getOne = async (req, res) => {
  const a = await AdvancePayment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Advance payment not found' });
  res.json(a);
};

const create = async (req, res) => {
  try {
    const userName = req.user?.name || 'system';
    const d = today();
    const body = {
      ...req.body,
      requestedBy: userName,
      stageIdx: 0,
      stageDates: [d, '', ''],
      stageBy: [userName, '', ''],
      rejected: false,
    };
    const adv = await AdvancePayment.create(body);
    res.status(201).json(adv);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  const adv = await AdvancePayment.findById(req.params.id);
  if (!adv) return res.status(404).json({ message: 'Advance payment not found' });
  const user = await resolveUser(req);
  if (adv.stageIdx > 0 && !isCMDUser(user)) {
    return res.status(403).json({ message: 'Cannot edit after AP approval — only CMD/admin can amend' });
  }
  Object.assign(adv, req.body);
  await adv.save();
  res.json(adv);
};

const remove = async (req, res) => {
  const adv = await AdvancePayment.findById(req.params.id);
  if (!adv) return res.status(404).json({ message: 'Advance payment not found' });
  const user = await resolveUser(req);
  if (adv.stageIdx > 0 && !isCMDUser(user)) {
    return res.status(403).json({ message: 'Cannot delete after AP approval — only CMD/admin' });
  }
  await adv.deleteOne();
  res.json({ message: 'Deleted' });
};

// ── Workflow actions ────────────────────────────────────────────────────
// PUT /api/advance-payments/:id/advance — push to next stage
const advanceStage = async (req, res) => {
  try {
    const adv = await AdvancePayment.findById(req.params.id);
    if (!adv) return res.status(404).json({ message: 'Advance not found' });
    if (adv.rejected) return res.status(400).json({ message: 'Rejected — cannot advance' });
    if (adv.stageIdx >= 2) return res.status(400).json({ message: 'Already CMD-approved' });

    const user = await resolveUser(req);

    // Stage 0 → 1 requires AP (CMD/admin can also do it as override)
    // Stage 1 → 2 requires CMD only
    if (adv.stageIdx === 0 && !(isAPUser(user) || isCMDUser(user))) {
      return res.status(403).json({ message: `Only Accounts Payable / Accountant can approve at this stage (your role: ${user?.role || '—'})` });
    }
    if (adv.stageIdx === 1 && !isCMDUser(user)) {
      return res.status(403).json({ message: `Only CMD can give final approval (your role: ${user?.role || '—'})` });
    }

    adv.stageIdx += 1;
    adv.stageDates[adv.stageIdx] = today();
    adv.stageBy[adv.stageIdx] = user?.name || 'system';
    await adv.save();
    res.json(adv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/advance-payments/:id/reject — terminal
const reject = async (req, res) => {
  try {
    const adv = await AdvancePayment.findById(req.params.id);
    if (!adv) return res.status(404).json({ message: 'Advance not found' });
    if (adv.rejected) return res.status(400).json({ message: 'Already rejected' });
    if (adv.stageIdx >= 2) return res.status(400).json({ message: 'Cannot reject after CMD approval' });

    const user = await resolveUser(req);

    if (adv.stageIdx === 0 && !(isAPUser(user) || isCMDUser(user))) {
      return res.status(403).json({ message: `Not authorized to reject (your role: ${user?.role || '—'})` });
    }
    if (adv.stageIdx === 1 && !isCMDUser(user)) {
      return res.status(403).json({ message: `Only CMD can reject at this stage (your role: ${user?.role || '—'})` });
    }

    adv.rejected = true;
    adv.rejectedAt = adv.stageIdx;
    adv.rejectedBy = user?.name || 'system';
    adv.rejectedDate = today();
    adv.rejectionReason = req.body.reason || '';
    await adv.save();
    res.json(adv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { list, getOne, create, update, remove, advanceStage, reject, STAGE_NAMES };
