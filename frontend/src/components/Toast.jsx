import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  return { toast, show }
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast toast--${toast.type}`}>
      {toast.message}
    </div>
  )
}
