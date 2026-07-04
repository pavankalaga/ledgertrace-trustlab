import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import routes from '../../routes';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import Tooltip from '@mui/material/Tooltip';

const ROUTES_WITHOUT_INVOICE_BTN = ['/fixed-payments', '/pdc-tracker', '/spend-analytics', '/transactions-register', '/supplier-ledger', '/advance-payments'];

const MAX_RESULTS = 10;

// Case-insensitive substring match against any of the fields.
const matches = (needle, ...fields) => {
  if (!needle) return false;
  const n = needle.toLowerCase();
  return fields.some(f => (f || '').toString().toLowerCase().includes(n));
};

const Topbar = ({ onShowToast, onOpenModal, onToggleSidebar, onLogout, user, invoices = [], onOpenDrawer }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = routes.find(r => r.path === location.pathname) || routes[0];
  const showInvoiceButton = !ROUTES_WITHOUT_INVOICE_BTN.includes(location.pathname);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside.
  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Reset dropdown state when route changes (user navigated away).
  useEffect(() => { setOpen(false); setQuery(''); }, [location.pathname]);

  const { supplierResults, invoiceResults } = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return { supplierResults: [], invoiceResults: [] };

    const invMatches = invoices.filter(inv =>
      matches(q, inv.id, inv.invno, inv.supplier, inv.total, inv.dept, inv.receivedBy)
    );

    // Group unique suppliers among matched invoices (a "supplier row" jumps to their invoice list).
    const supplierMap = new Map();
    for (const inv of invMatches) {
      if (!inv.supplier) continue;
      if (!supplierMap.has(inv.supplier)) {
        supplierMap.set(inv.supplier, { supplier: inv.supplier, count: 0, unpaid: 0 });
      }
      const s = supplierMap.get(inv.supplier);
      s.count += 1;
      if (inv.stageIdx < 7) s.unpaid += 1;
    }

    return {
      supplierResults: [...supplierMap.values()].slice(0, 5),
      invoiceResults: invMatches.slice(0, MAX_RESULTS),
    };
  }, [query, invoices]);

  const flatItems = useMemo(
    () => [
      ...supplierResults.map(s => ({ type: 'supplier', ...s })),
      ...invoiceResults.map(inv => ({ type: 'invoice', invoice: inv })),
    ],
    [supplierResults, invoiceResults]
  );

  useEffect(() => { setActiveIdx(0); }, [query]);

  const pickItem = (item) => {
    if (!item) return;
    if (item.type === 'invoice') {
      onOpenDrawer?.(item.invoice.id);
    } else if (item.type === 'supplier') {
      navigate(`/supplier-ledger?supplier=${encodeURIComponent(item.supplier)}`);
    }
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pickItem(flatItems[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showDropdown = open && query.trim().length >= 2;
  const hasResults = flatItems.length > 0;

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconButton className="hamburger" onClick={onToggleSidebar} sx={{ display: 'none', color: 'var(--ink)' }}>
          <MenuIcon />
        </IconButton>

        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}>
          <Typography sx={{ fontSize: 13, color: 'var(--ink4)' }}>{currentRoute.section}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{currentRoute.label}</Typography>
        </Breadcrumbs>
      </div>

      <div className="tb-right">
        <div ref={containerRef} style={{ position: 'relative' }}>
          <TextField
            size="small"
            placeholder="Search invoices, suppliers…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'var(--ink4)' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: 280,
              '& .MuiOutlinedInput-root': {
                fontSize: 12.5,
                borderRadius: '8px',
                backgroundColor: 'var(--bg)',
              },
            }}
          />

          {showDropdown && (
            <Paper
              elevation={6}
              sx={{
                position: 'absolute',
                top: 40,
                right: 0,
                width: 380,
                maxHeight: 460,
                overflowY: 'auto',
                borderRadius: '8px',
                zIndex: 1300,
                border: '1px solid var(--rule)',
              }}
            >
              {!hasResults ? (
                <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--ink4)', textAlign: 'center' }}>
                  No matches for <strong>"{query}"</strong>
                </div>
              ) : (
                <>
                  {supplierResults.length > 0 && (
                    <>
                      <div style={{ padding: '8px 12px 4px', fontSize: 10, letterSpacing: 1, color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>Suppliers</div>
                      {supplierResults.map((s, i) => {
                        const idx = i;
                        const active = idx === activeIdx;
                        return (
                          <div
                            key={`s-${s.supplier}`}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickItem({ type: 'supplier', ...s })}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              background: active ? 'var(--bg)' : 'transparent',
                              borderLeft: active ? '3px solid var(--s1)' : '3px solid transparent',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.supplier}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--ink4)' }}>{s.count} invoice{s.count === 1 ? '' : 's'}{s.unpaid > 0 ? ` · ${s.unpaid} unpaid` : ''}</div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace" }}>OPEN →</span>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {invoiceResults.length > 0 && (
                    <>
                      <div style={{ padding: '8px 12px 4px', fontSize: 10, letterSpacing: 1, color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', borderTop: supplierResults.length > 0 ? '1px solid var(--rule2)' : 'none' }}>Invoices</div>
                      {invoiceResults.map((inv, i) => {
                        const idx = supplierResults.length + i;
                        const active = idx === activeIdx;
                        return (
                          <div
                            key={`i-${inv._id || inv.id}`}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickItem({ type: 'invoice', invoice: inv })}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              background: active ? 'var(--bg)' : 'transparent',
                              borderLeft: active ? '3px solid var(--s1)' : '3px solid transparent',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 11, color: 'var(--s1)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{inv.id}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.supplier}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--ink4)' }}>{inv.invno ? `Bill ${inv.invno} · ` : ''}{inv.dept || inv.receivedBy || ''}</div>
                            </div>
                            <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink2)' }}>{inv.total}</div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </Paper>
          )}
        </div>

        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={() => onShowToast('Exporting data…')}
          sx={{
            textTransform: 'none',
            fontSize: 12.5,
            borderColor: 'var(--rule)',
            color: 'var(--ink3)',
            borderRadius: '8px',
            '&:hover': { borderColor: 'var(--ink4)', background: 'var(--bg)' },
          }}
        >
          Export
        </Button>

        {showInvoiceButton && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={onOpenModal}
            sx={{
              textTransform: 'none',
              fontSize: 12.5,
              backgroundColor: 'var(--coral)',
              borderRadius: '8px',
              boxShadow: 'none',
              '&:hover': { backgroundColor: '#d03535', boxShadow: 'none' },
            }}
          >
            Register Invoice
          </Button>
        )}

        <Tooltip title={`Logout (${user?.name || ''})`}>
          <IconButton onClick={onLogout} sx={{ color: 'var(--ink3)', ml: 0.5 }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

export default Topbar;
