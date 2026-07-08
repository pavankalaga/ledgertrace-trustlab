import React, { useState, useEffect } from 'react';
import {
  useLoanStore, addProperty, updateProperty,
  outstanding, typeTag,
  fmtLakh, fmtDate, daysTo, TODAY,
} from '../../../loanStore';
import LoanModal from './LoanModal';
import './loans.css';

const emptyProp = {
  desc: '', owner: '', propType: 'Commercial', deed: '',
  survey: '', extent: '',
  emType: 'Equitable Mortgage (deposit of title deeds)', emDate: '',
  sro: '', value: '', valDate: '', valuer: '',
  facilities: [],
  insPolicy: '', insExpiry: '',
  deedsHeldBy: '',
};

const PropertyModal = ({ isOpen, onClose, editingId }) => {
  const { PROPERTIES } = useLoanStore();
  const initial = editingId ? PROPERTIES.find((p) => p.id === editingId) : null;
  const [form, setForm] = useState(() => initial ? { ...initial, facilities: (initial.facilities || []).join(', ') } : { ...emptyProp, facilities: '' });

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? { ...initial, facilities: (initial.facilities || []).join(', ') } : { ...emptyProp, facilities: '' });
    }
  }, [isOpen, initial]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (!form.desc) { alert('Property description is required.'); return; }
    const payload = {
      ...form,
      value: +form.value || 0,
      facilities: (form.facilities || '').split(',').map((x) => x.trim()).filter(Boolean),
      emDate: form.emDate || null,
      valDate: form.valDate || null,
      insExpiry: form.insExpiry || null,
    };
    if (editingId) {
      updateProperty(editingId, payload);
    } else {
      addProperty(payload);
    }
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose}>
      <h3>{editingId ? `Edit Property ${editingId}` : 'Add Mortgaged Property'}</h3>
      <div className="form-grid">
        <div className="fg full"><label>Property Description / Address</label><input type="text" value={form.desc} onChange={set('desc')} /></div>
        <div className="fg"><label>Owner on Title</label><input type="text" value={form.owner} onChange={set('owner')} /></div>
        <div className="fg"><label>Property Type</label>
          <select value={form.propType} onChange={set('propType')}>
            <option>Commercial</option><option>Residential</option><option>Industrial</option><option>Open Land</option>
          </select>
        </div>
        <div className="fg"><label>Title Deed / Document No.</label><input type="text" value={form.deed} onChange={set('deed')} /></div>
        <div className="fg"><label>Survey / Plot No.</label><input type="text" value={form.survey} onChange={set('survey')} /></div>
        <div className="fg"><label>Extent</label><input type="text" value={form.extent} onChange={set('extent')} placeholder="e.g. 420 sq. yds" /></div>
        <div className="fg"><label>Mortgage Type</label>
          <select value={form.emType} onChange={set('emType')}>
            <option>Equitable Mortgage (deposit of title deeds)</option>
            <option>Registered Mortgage</option>
          </select>
        </div>
        <div className="fg"><label>Mortgage Created On</label><input type="date" value={form.emDate || ''} onChange={set('emDate')} /></div>
        <div className="fg"><label>SRO / Jurisdiction</label><input type="text" value={form.sro} onChange={set('sro')} /></div>
        <div className="fg"><label>Market Value (₹)</label><input type="number" min="0" value={form.value} onChange={set('value')} /></div>
        <div className="fg"><label>Valuation Date</label><input type="date" value={form.valDate || ''} onChange={set('valDate')} /></div>
        <div className="fg full"><label>Valuer</label><input type="text" value={form.valuer} onChange={set('valuer')} /></div>
        <div className="fg full"><label>Facilities Secured (comma-separated IDs)</label><input type="text" value={form.facilities} onChange={set('facilities')} placeholder="e.g. BL-001, BL-002" /></div>
        <div className="fg"><label>Insurance Policy No.</label><input type="text" value={form.insPolicy} onChange={set('insPolicy')} /></div>
        <div className="fg"><label>Insurance Expiry</label><input type="date" value={form.insExpiry || ''} onChange={set('insExpiry')} /></div>
      </div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Save property</button>
      </div>
    </LoanModal>
  );
};

const MortgagedProperties = () => {
  const { LOANS, PROPERTIES } = useLoanStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const totVal = PROPERTIES.reduce((a, p) => a + (p.value || 0), 0);
  const secured = new Set();
  PROPERTIES.forEach((p) => (p.facilities || []).forEach((f) => secured.add(f)));
  const securedOut = LOANS.filter((l) => secured.has(l.id)).reduce((a, l) => a + outstanding(l), 0);
  const cover = securedOut ? totVal / securedOut : 0;

  const open = (id) => { setEditingId(id || null); setModalOpen(true); };

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div>
          <h1>Property Mortgage Register</h1>
          <p>Immovable properties mortgaged as security for TDPL borrowings — title particulars, mortgage creation, valuation and insurance. Title deeds held by the first-charge lender.</p>
        </div>
        <span className="ldk-code">TL-FIN-BLM-001 · Rev 1.0</span>
      </div>

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <button className="ldk-btn primary" onClick={() => open()}>+ Add property</button>
      </div>

      <div className="ldk-kpis">
        <div className="ldk-kpi"><div className="lbl">Properties Mortgaged</div><div className="val">{PROPERTIES.length}</div></div>
        <div className="ldk-kpi"><div className="lbl">Aggregate Market Value</div><div className="val">{fmtLakh(totVal)}</div><div className="sub">per latest bank-empanelled valuations</div></div>
        <div className="ldk-kpi gold"><div className="lbl">Secured Outstanding</div><div className="val">{fmtLakh(securedOut)}</div><div className="sub">facilities backed by these properties</div></div>
        <div className="ldk-kpi gold"><div className="lbl">Collateral Cover</div><div className="val">{cover ? cover.toFixed(2) + '×' : '—'}</div><div className="sub">market value / secured outstanding</div></div>
      </div>

      {PROPERTIES.length === 0 && <div className="ldk-card ldk-empty">No mortgaged properties on record.</div>}

      {PROPERTIES.map((pr) => {
        const insDays = pr.insExpiry ? daysTo(pr.insExpiry) : null;
        const valStale = pr.valDate && (TODAY - new Date(pr.valDate)) > 3 * 365 * 864e5;
        return (
          <div key={pr.id} className="ldk-card">
            <div className="prop-head">
              <div>
                <span className="ldk-mono" style={{ fontSize: 11, color: 'var(--ldk-muted)' }}>{pr.id}</span>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{pr.desc}</div>
                <div style={{ fontSize: 12, color: 'var(--ldk-muted)', marginTop: 2 }}>Owner on title: {pr.owner}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="ldk-tag tl">{pr.propType}</span>
                <button className="ldk-btn ghost sm" onClick={() => open(pr.id)}>Edit</button>
              </div>
            </div>
            <div className="detail-grid">
              <div className="dfield"><div className="k">Title Deed</div><div className="v ldk-mono" style={{ fontSize: 11.5 }}>{pr.deed}</div></div>
              <div className="dfield"><div className="k">Survey / Plot</div><div className="v ldk-mono" style={{ fontSize: 11.5 }}>{pr.survey}</div></div>
              <div className="dfield"><div className="k">Extent</div><div className="v">{pr.extent}</div></div>
              <div className="dfield"><div className="k">Mortgage Type</div><div className="v">{pr.emType}</div></div>
              <div className="dfield"><div className="k">Created On / SRO</div><div className="v">{fmtDate(pr.emDate)}<br /><span style={{ fontSize: 11, color: 'var(--ldk-muted)' }}>{pr.sro}</span></div></div>
              <div className="dfield"><div className="k">Market Value</div><div className="v ldk-mono" style={{ color: 'var(--ldk-teal-dark)', fontWeight: 700 }}>{fmtLakh(pr.value)}</div></div>
              <div className="dfield"><div className="k">Valuation</div><div className="v">{fmtDate(pr.valDate)}{valStale && <span className="ldk-tag due" style={{ marginLeft: 6 }}>Stale (&gt;3y)</span>}<br /><span style={{ fontSize: 11, color: 'var(--ldk-muted)' }}>{pr.valuer}</span></div></div>
              <div className="dfield"><div className="k">Title Deeds Held By</div><div className="v" style={{ fontSize: 12 }}>{pr.deedsHeldBy || '—'}</div></div>
              <div className="dfield"><div className="k">Insurance</div><div className="v" style={{ fontSize: 12 }}>{pr.insPolicy || '—'}<br />
                {pr.insExpiry && (
                  <span className={`ldk-tag ${insDays < 0 ? 'over' : insDays <= 45 ? 'due' : 'ok'}`} style={{ marginTop: 3 }}>
                    {insDays < 0 ? 'Expired' : 'Valid to'} {fmtDate(pr.insExpiry)}
                  </span>
                )}
              </div></div>
            </div>
            <div className="prop-facs">
              <b style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--ldk-muted)' }}>Facilities secured</b>
              &nbsp;&nbsp;
              {(pr.facilities || []).map((f) => {
                const l = LOANS.find((x) => x.id === f);
                return l
                  ? <span key={f} className={`ldk-tag ${typeTag(l.type)}`} title={l.lender} style={{ marginRight: 4 }}>{f} · {l.lender}</span>
                  : <span key={f} className="ldk-tag closed" style={{ marginRight: 4 }}>{f}</span>;
              })}
              {(!pr.facilities || pr.facilities.length === 0) && '—'}
            </div>
          </div>
        );
      })}

      <PropertyModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} editingId={editingId} />
    </div>
  );
};

export default MortgagedProperties;
