import { useEffect, useReducer, useRef, useState } from 'react'
import { ArrowCounterClockwise, List, X } from '@phosphor-icons/react'
import { initialProject, projectReducer } from './state/projectStore'
import { loadDraft, saveDraft } from './storage'
import { useAuth } from './state/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { hydrateSavedProject } from './lib/openProject'
import UploadStep from './steps/UploadStep'
import ExtractStep from './steps/ExtractStep'
import StyleStep from './steps/StyleStep'
import UserMenu from './components/UserMenu'
import SavesDropdown from './components/SavesDropdown'
import SplashScreen from './components/SplashScreen'
import PasswordResetModal from './components/PasswordResetModal'
import PawCursor from './components/PawCursor'
import './App.css'


function HeaderActions({ project, dispatch, user, onOpenProject, refreshKey }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const showStartOver =
    project.step > 0 ||
    project.photoUrl ||
    project.shapeId ||
    project.currentProjectId

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className="header-actions">
      <div className="header-collapsible" ref={menuRef}>
        <button
          type="button"
          className="header-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
        </button>
        <div className={`header-actions-list${menuOpen ? ' is-open' : ''}`}>
          {showStartOver && (
            <button
              className="start-over"
              onClick={() => { setMenuOpen(false); dispatch({ type: 'RESET' }) }}
              type="button"
            >
              <ArrowCounterClockwise size={16} weight="bold" />
              <span>Start over</span>
            </button>
          )}
          {user && isSupabaseConfigured && (
            <SavesDropdown user={user} onOpenProject={onOpenProject} refreshKey={refreshKey} />
          )}
        </div>
      </div>
      <UserMenu />
    </div>
  )
}

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initialProject, (init) => {
    // When auth-gated, always start fresh on step 1 — cloud saves are the
    // persistence layer, not localStorage. Anonymous mode still uses drafts.
    if (isSupabaseConfigured) return init
    const draft = loadDraft()
    return draft ? { ...init, ...draft } : init
  })
  const [openingStatus, setOpeningStatus] = useState(null)
  const [savesRefreshKey, setSavesRefreshKey] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) saveDraft(project)
  }, [project])

  const { user, loading: authLoading, recovering, clearRecovering } = useAuth()

  async function handleOpenProject(row) {
    setOpeningStatus('Fetching your cloud…')
    try {
      const patch = await hydrateSavedProject(row, (msg) => setOpeningStatus(msg))
      dispatch({ type: 'LOAD_PROJECT', patch })
    } finally {
      setOpeningStatus(null)
    }
  }

  // Bump savesRefreshKey whenever a save happens so the dropdown re-fetches.
  useEffect(() => {
    if (project.currentProjectId) setSavesRefreshKey((k) => k + 1)
  }, [project.currentProjectId])

  // Updating an existing save keeps the same currentProjectId, so the above
  // effect doesn't fire — the dropdown would keep its stale row in memory.
  // Manual bump so callers can force a refresh after Update.
  const bumpSavesRefresh = () => setSavesRefreshKey((k) => k + 1)

  // While the session is being restored from storage, render nothing so we
  // don't flash the main UI before falling back to the splash. Only matters
  // for ~one frame on initial mount or after a forced reload.
  if (isSupabaseConfigured && authLoading) {
    return <div className="app-loading" />
  }
  if (isSupabaseConfigured && !user) {
    return <SplashScreen />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">petprint</h1>
        <HeaderActions
          project={project}
          dispatch={dispatch}
          user={user}
          onOpenProject={handleOpenProject}
          refreshKey={savesRefreshKey}
        />
      </header>
      <main className="app-main">
        <div className={`step-card${project.step === 2 ? ' step-card--wide' : ''}`}>
          <div className="step-body">
            {project.step === 0 && <UploadStep project={project} dispatch={dispatch} />}
            {project.step === 1 && <ExtractStep project={project} dispatch={dispatch} />}
            {project.step === 2 && <StyleStep project={project} dispatch={dispatch} onSavesChanged={bumpSavesRefresh} />}
          </div>
        </div>
      </main>
      <footer className="app-footer">
        <a href={`${import.meta.env.BASE_URL}legal/privacy.html`} target="_blank" rel="noopener noreferrer">Privacy</a>
        <span aria-hidden="true">·</span>
        <a href={`${import.meta.env.BASE_URL}legal/terms.html`} target="_blank" rel="noopener noreferrer">Terms</a>
        <span aria-hidden="true">·</span>
        <a href="mailto:tcorneliusart@gmail.com">Contact</a>
      </footer>
      <PawCursor />
      <PasswordResetModal open={recovering} onDone={clearRecovering} />
      {openingStatus && (
        <div className="opening-overlay">
          <div className="opening-card">
            <div className="paw-loader"><span /><span /><span /><span /></div>
            <p>{openingStatus}</p>
          </div>
        </div>
      )}
    </div>
  )
}
