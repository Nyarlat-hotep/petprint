import { useEffect, useRef, useState } from 'react'
import { UserCircle, SignOut, Trash } from '@phosphor-icons/react'
import { useAuth } from '../state/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { clearDraft } from '../storage'
import SignInModal from './SignInModal'
import ConfirmDialog from './ConfirmDialog'
import './UserMenu.css'

export default function UserMenu() {
  const { user, signOut, deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isSupabaseConfigured) return null

  if (!user) {
    return (
      <>
        <button className="user-icon-btn" onClick={() => setModalOpen(true)} aria-label="Sign in" type="button">
          <UserCircle size={22} weight="bold" />
        </button>
        <SignInModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await deleteAccount()
      clearDraft()
      window.location.reload()
    } catch (e) {
      setDeleting(false)
      setConfirmDelete(false)
      alert(`Could not delete account: ${e.message || e}`)
    }
  }

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Account" type="button">
        <UserCircle size={22} weight="bold" />
      </button>
      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-email">{user.email}</div>
          <button
            type="button"
            className="user-menu-signout"
            onClick={async () => {
              setOpen(false)
              clearDraft()
              try { localStorage.removeItem('petprint-guest') } catch { /* ignore */ }
              await signOut()
              window.location.reload()
            }}
          >
            <SignOut size={16} weight="bold" />
            <span>Sign out</span>
          </button>
          <button
            type="button"
            className="user-menu-delete"
            onClick={() => { setOpen(false); setConfirmDelete(true) }}
          >
            <Trash size={16} weight="bold" />
            <span>Delete account</span>
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        message="This permanently removes your account, all saved clouds, and any photos. This cannot be undone."
        confirmLabel="Delete forever"
        destructive
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => !deleting && setConfirmDelete(false)}
      />
    </div>
  )
}
