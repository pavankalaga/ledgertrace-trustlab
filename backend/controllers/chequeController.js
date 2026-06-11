const Cheque = require('../models/Cheque');

const actor = (req) => req.user?.name || 'system';

// ── CRUD ────────────────────────────────────────────────────────────────
const list = async (req, res) => {
  const { status, approval, branch, search } = req.query;
  const q = {};
  if (status) q.status = status;
  if (approval) q.approval = approval;
  if (branch) q.branch = branch;
  if (search) {
    q.$or = [
      { chequeId: new RegExp(search, 'i') },
      { chequeNo: new RegExp(search, 'i') },
      { payee: new RegExp(search, 'i') },
      { drawnAccount: new RegExp(search, 'i') },
      { purpose: new RegExp(search, 'i') },
      { invoiceRef: new RegExp(search, 'i') },
    ];
  }
  const cheques = await Cheque.find(q).sort({ issueDate: -1, createdAt: -1 });
  res.json(cheques);
};

const getOne = async (req, res) => {
  const chq = await Cheque.findById(req.params.id);
  if (!chq) return res.status(404).json({ message: 'Cheque not found' });
  res.json(chq);
};

const create = async (req, res) => {
  const who = actor(req);
  const body = { ...req.body };
  // every entry awaits a checker; the acting user is recorded as maker
  body.approval = 'pending';
  body.maker = who;
  body.makerAt = new Date();
  body.checker = '';
  body.checkerAt = undefined;
  body.checkerNote = '';
  body.timeline = [{ event: 'Created', desc: `Issued cheque lodged by ${who}`, user: who }];
  const chq = await Cheque.create(body);
  res.status(201).json(chq);
};

const update = async (req, res) => {
  const cur = await Cheque.findById(req.params.id);
  if (!cur) return res.status(404).json({ message: 'Cheque not found' });
  const who = actor(req);

  if (req.body.status && req.body.status !== cur.status) {
    cur.timeline.push({ event: 'Status Change', desc: `${cur.status} → ${req.body.status}`, user: who });
  }
  // Editing the entry re-submits it for approval (maker–checker integrity)
  Object.assign(cur, req.body);
  cur.approval = 'pending';
  cur.maker = who;
  cur.makerAt = new Date();
  cur.checker = '';
  cur.checkerAt = undefined;
  cur.checkerNote = '';
  cur.timeline.push({ event: 'Edited', desc: `Amended by ${who} — re-submitted for approval`, user: who });
  await cur.save();
  res.json(cur);
};

const remove = async (req, res) => {
  const chq = await Cheque.findByIdAndDelete(req.params.id);
  if (!chq) return res.status(404).json({ message: 'Cheque not found' });
  res.json({ message: 'Cheque deleted' });
};

// PUT /api/cheques/:id/status — advance lifecycle (issued → presented → cleared, or stop/cancel/dishonour)
const changeStatus = async (req, res) => {
  const { status, reason, clearedDate } = req.body;
  const cur = await Cheque.findById(req.params.id);
  if (!cur) return res.status(404).json({ message: 'Cheque not found' });
  const who = actor(req);

  cur.timeline.push({ event: 'Status Change', desc: `${cur.status} → ${status}${reason ? ' (' + reason + ')' : ''}`, user: who });
  cur.status = status;
  if (status === 'Cleared' && !cur.clearedDate) {
    cur.clearedDate = clearedDate || new Date().toISOString().slice(0, 10);
  }
  if (['Stop Payment', 'Cancelled', 'Dishonoured'].includes(status) && reason) {
    cur.voidReason = reason;
  }
  await cur.save();
  res.json(cur);
};

// PUT /api/cheques/:id/approve — checker approves (must differ from maker)
const approve = async (req, res) => {
  const cur = await Cheque.findById(req.params.id);
  if (!cur) return res.status(404).json({ message: 'Cheque not found' });
  if (cur.approval !== 'pending') return res.status(400).json({ message: 'Cheque is not awaiting approval' });
  const who = actor(req);
  if (cur.maker && cur.maker === who) {
    return res.status(400).json({ message: 'A different person must approve (maker–checker separation)' });
  }
  cur.approval = 'approved';
  cur.checker = who;
  cur.checkerAt = new Date();
  cur.checkerNote = '';
  cur.timeline.push({ event: 'Approved', desc: `Approved by ${who}`, user: who });
  await cur.save();
  res.json(cur);
};

// PUT /api/cheques/:id/reject — checker returns to maker with a note
const reject = async (req, res) => {
  const cur = await Cheque.findById(req.params.id);
  if (!cur) return res.status(404).json({ message: 'Cheque not found' });
  if (cur.approval !== 'pending') return res.status(400).json({ message: 'Cheque is not awaiting approval' });
  const who = actor(req);
  if (cur.maker && cur.maker === who) {
    return res.status(400).json({ message: 'A different person must check this entry' });
  }
  cur.approval = 'rejected';
  cur.checker = who;
  cur.checkerAt = new Date();
  cur.checkerNote = (req.body.note || '').trim();
  cur.timeline.push({ event: 'Returned', desc: `Returned to maker by ${who}${cur.checkerNote ? ' — ' + cur.checkerNote : ''}`, user: who });
  await cur.save();
  res.json(cur);
};

module.exports = { list, getOne, create, update, remove, changeStatus, approve, reject };
