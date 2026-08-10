import { useState, useRef, useEffect } from 'react'

export default function SearchableSelect({ value, onChange, items, onAdd, onDelete, placeholder = '— Выберите —' }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref      = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const filtered = items.filter(item =>
    item.toLowerCase().includes(search.toLowerCase())
  )
  const canAdd = search.trim() &&
    !items.some(i => i.toLowerCase() === search.trim().toLowerCase())

  function select(item) {
    onChange(item)
    setSearch('')
    setOpen(false)
  }

  function handleAdd() {
    const name = search.trim()
    onAdd(name)
    onChange(name)
    setSearch('')
    setOpen(false)
  }

  async function handleDelete(e, item) {
    e.stopPropagation()
    await onDelete(item)
    if (value === item) onChange('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        className="input"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', cursor: 'pointer',
          userSelect: 'none', padding: '0 14px', minHeight: 44,
        }}
      >
        <span style={{ flex: 1, fontSize: 15, color: value ? 'var(--text)' : '#aaa' }}>
          {value || placeholder}
        </span>
        <span style={{ color: '#aaa', fontSize: 11, marginLeft: 6, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 999, background: '#fff',
          border: '1.5px solid var(--border)', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '10px 10px 6px' }}>
            <input
              ref={inputRef}
              type="text"
              className="input"
              placeholder="Поиск..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canAdd) handleAdd()
                if (e.key === 'Escape') setOpen(false)
              }}
              style={{ marginBottom: 0 }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && !canAdd && (
              <div style={{ padding: '12px 14px', color: '#aaa', fontSize: 13, textAlign: 'center' }}>
                Ничего не найдено
              </div>
            )}

            {filtered.map(item => (
              <div
                key={item}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '9px 12px', cursor: 'pointer', gap: 8,
                  background: item === value ? '#f0f7ff' : 'transparent',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (item !== value) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { e.currentTarget.style.background = item === value ? '#f0f7ff' : 'transparent' }}
              >
                <span
                  style={{ flex: 1, fontSize: 14, fontWeight: item === value ? 600 : 400 }}
                  onClick={() => select(item)}
                >
                  {item}
                </span>
                {item === value && (
                  <span style={{ color: 'var(--primary)', fontSize: 13, marginRight: 4 }}>✓</span>
                )}
                <button
                  onClick={e => handleDelete(e, item)}
                  title="Удалить"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#cbd5e1', fontSize: 18, lineHeight: 1,
                    padding: '0 2px', borderRadius: 4,
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add new */}
            {canAdd && (
              <div
                onClick={handleAdd}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  color: 'var(--primary)', fontWeight: 600, fontSize: 13,
                  borderTop: filtered.length ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
                Добавить «{search.trim()}»
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
