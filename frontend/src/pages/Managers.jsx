import { useState, useEffect } from 'react'
import { api } from '../api'
import { Toast, useToast } from '../components/Toast'

export default function Managers() {
  const [managers,  setManagers]  = useState([])
  const [newName,   setNewName]   = useState('')
  const [adding,    setAdding]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [toDelete,  setToDelete]  = useState(null)
  const { toast, show } = useToast()

  useEffect(() => {
    api.getManagers()
      .then(r => r.success && setManagers(r.managers))
      .catch(() => show('Ошибка загрузки', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return show('Введите имя менеджера', 'error')

    setAdding(true)
    try {
      const res = await api.addManager(name)
      if (res.success) {
        setManagers(res.managers)
        setNewName('')
        show('✅ Менеджер добавлен')
      } else {
        show('❌ ' + res.error, 'error')
      }
    } catch {
      show('❌ Ошибка соединения', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    const name = toDelete
    setToDelete(null)
    try {
      const res = await api.removeManager(name)
      if (res.success) {
        setManagers(res.managers)
        show(`✅ "${name}" удалён`)
      } else {
        show('❌ ' + res.error, 'error')
      }
    } catch {
      show('❌ Ошибка соединения', 'error')
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">➕ Добавить менеджера</div>
        <Toast toast={toast} />
        <div className="add-row">
          <input
            className="input"
            type="text"
            placeholder="Имя менеджера"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn-add" onClick={handleAdd} disabled={adding}>
            {adding ? '⏳' : 'Добавить'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📋 Список менеджеров</div>
        {loading ? (
          <div className="loader">⏳ Загрузка...</div>
        ) : managers.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👤</div>
            <p>Менеджеров пока нет. Добавьте первого выше.</p>
          </div>
        ) : (
          <ul className="manager-list">
            {managers.map(m => (
              <li key={m} className="manager-item">
                <div className="manager-name">
                  <div className="avatar">{m.charAt(0).toUpperCase()}</div>
                  {m}
                </div>
                <button className="btn-delete" onClick={() => setToDelete(m)}>
                  🗑 Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toDelete && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setToDelete(null)}>
          <div className="dialog">
            <h3>Удалить менеджера?</h3>
            <p>«{toDelete}» будет удалён из списка. Данные о продажах сохранятся.</p>
            <div className="dialog-btns">
              <button className="btn-cancel"  onClick={() => setToDelete(null)}>Отмена</button>
              <button className="btn-confirm" onClick={handleDelete}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
