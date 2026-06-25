import React, { useState, useRef, useEffect } from 'react';

// Click-to-edit text field. Saves on blur or Enter, cancels on Escape.
// For multiline, Ctrl/Cmd+Enter commits (plain Enter inserts a newline).
const InlineEdit = ({
  value,
  onSave,
  placeholder = 'Click to add…',
  multiline = false,
  disabled = false,
  displayStyle = {},
  inputStyle = {},
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current.setSelectionRange) {
        const len = (draft || '').length;
        ref.current.setSelectionRange(len, len);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = async () => {
    if (saving) return;
    const next = draft.trim();
    if (next === (value || '').trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      console.error('InlineEdit save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value || '');
    setEditing(false);
  };

  const handleKey = (e) => {
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
    if (multiline && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  if (editing) {
    const baseStyle = {
      width: '100%',
      padding: multiline ? '6px 8px' : '4px 8px',
      fontSize: 12.5,
      fontFamily: 'inherit',
      border: '1px solid var(--s1)',
      borderRadius: 4,
      background: 'var(--white)',
      color: 'var(--ink)',
      outline: 'none',
      resize: multiline ? 'vertical' : 'none',
      boxShadow: '0 0 0 3px rgba(13,148,136,0.15)',
      ...inputStyle,
    };
    if (multiline) {
      return (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          disabled={saving}
          rows={2}
          style={baseStyle}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        ref={ref}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        disabled={saving}
        style={baseStyle}
        placeholder={placeholder}
      />
    );
  }

  const hasValue = (value || '').trim().length > 0;
  return (
    <span
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? '' : 'Click to edit'}
      style={{
        cursor: disabled ? 'default' : 'text',
        padding: '2px 6px',
        borderRadius: 3,
        borderBottom: hasValue ? 'none' : '1px dashed var(--ink4)',
        color: hasValue ? 'inherit' : 'var(--ink4)',
        fontStyle: hasValue ? 'normal' : 'italic',
        display: 'inline-block',
        minWidth: 40,
        transition: 'background 0.15s',
        ...displayStyle,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {hasValue ? value : placeholder}
    </span>
  );
};

export default InlineEdit;
