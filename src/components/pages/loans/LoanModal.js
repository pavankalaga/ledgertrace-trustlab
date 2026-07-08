import React, { useEffect } from 'react';

/**
 * Shared modal shell for LoanDesk. Click on backdrop closes; ESC closes.
 * Not portaled — Modal renders at the point of use so the .ldk-modal-bg
 * scope catches the shared CSS.
 */
const LoanModal = ({ isOpen, onClose, children, width }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="ldk-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="ldk-modal" style={width ? { maxWidth: width } : undefined}>
        {children}
      </div>
    </div>
  );
};

export default LoanModal;
