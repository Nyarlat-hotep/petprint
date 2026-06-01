import { useEffect } from 'react'
import { Heart, DownloadSimple, Printer } from '@phosphor-icons/react'
import './DonationModal.css'

// TODO: replace the PayPal and Buy Me a Coffee handles below with your own.
const VENMO_HANDLE = 'Tcornelius'
const PAYPAL_HANDLE = 'Tcorn404'
const BMC_HANDLE = 'tcorn404'

const VENMO_WEB = `https://venmo.com/u/${VENMO_HANDLE}`
const PAYPAL_URL = `https://paypal.me/${PAYPAL_HANDLE}`
const BMC_URL = `https://buymeacoffee.com/${BMC_HANDLE}`

export default function DonationModal({ open, busy, mode = 'download', onDownload, onSkip }) {
  const isPrint = mode === 'print'
  const Icon = isPrint ? Printer : DownloadSimple
  const ctaLabel = busy
    ? (isPrint ? 'Warming up the printer…' : 'Painting their portrait…')
    : (isPrint ? 'Print my image' : 'Download my image')
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onSkip?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onSkip])

  if (!open) return null

  return (
    <div className="donation-backdrop" onClick={() => !busy && onSkip?.()}>
      <div className="donation-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="donation-header">
          <Heart size={28} weight="fill" className="donation-heart" />
          <h3>Enjoying Petprint?</h3>
          <p>If this was useful, a small tip keeps me building. Totally optional — your download is ready either way.</p>
        </div>

        <div className="donation-options">
          <a
            className="donation-option venmo"
            href={VENMO_WEB}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="donation-label">Tip on Venmo</span>
            <span className="donation-handle">@{VENMO_HANDLE}</span>
          </a>
          <a
            className="donation-option paypal"
            href={PAYPAL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="donation-label">Tip on PayPal</span>
            <span className="donation-handle">paypal.me/{PAYPAL_HANDLE}</span>
          </a>
          <a
            className="donation-option bmc"
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="donation-label">Buy Me a Coffee</span>
            <span className="donation-handle">buymeacoffee.com/{BMC_HANDLE}</span>
          </a>
        </div>

        <div className="donation-actions">
          <button
            type="button"
            className="donation-skip"
            onClick={onSkip}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="donation-primary"
            onClick={onDownload}
            disabled={busy}
            autoFocus
          >
            <Icon size={16} weight="bold" />
            <span>{ctaLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
