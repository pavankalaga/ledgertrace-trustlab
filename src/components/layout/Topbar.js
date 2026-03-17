import React from 'react';
import { useLocation } from 'react-router-dom';
import routes from '../../routes';

// MUI Components
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';

// MUI Icons
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import Tooltip from '@mui/material/Tooltip';

const Topbar = ({ onShowToast, onOpenModal, onToggleSidebar, onLogout, user }) => {
  const location = useLocation();
  const currentRoute = routes.find(r => r.path === location.pathname) || routes[0];

  return (
    <div className="topbar">

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Hamburger — only visible on mobile/tablet */}
        <IconButton className="hamburger" onClick={onToggleSidebar} sx={{ display: 'none', color: 'var(--ink)' }}>
          <MenuIcon />
        </IconButton>

        {/* MUI Breadcrumbs */}
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}>
        <Typography sx={{ fontSize: 13, color: 'var(--ink4)' }}>
          {currentRoute.section}
        </Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          {currentRoute.label}
        </Typography>
      </Breadcrumbs>
      </div>

      <div className="tb-right">

        {/* MUI TextField — replaces div.searchbar + svg + input */}
        <TextField
          size="small"
          placeholder="Search invoices, suppliers…"
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
            width: 240,
            '& .MuiOutlinedInput-root': {
              fontSize: 12.5,
              borderRadius: '8px',
              backgroundColor: 'var(--bg)',
            },
          }}
        />

        {/* MUI Button (outlined) — replaces button.btn.btn-ghost */}
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

        {/* MUI Button (contained) — replaces button.btn.btn-primary */}
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

        {/* Logout */}
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
