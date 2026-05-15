import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { setShareEnabled, regenerateShareToken } from '../../lib/firestore.js'

export default function ShareModal({ onClose }) {
  const user           = useStore((s) => s.user)
  const currentChartId = useStore((s) => s.currentChartId)
  const shareConfig    = useStore((s) => s.shareConfig)
  const setShareConfig = useStore((s) => s.setShareConfig)

  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!user || !currentChartId) return null

  const enabled = !!shareConfig?.enabled
  const token   = shareConfig?.token
  const url = enabled && token
    ? `${window.location.origin}${window.location.pathname}?s=${token}`
    : ''

  async function handleToggle() {
    setBusy(true)
    try {
      const next = await setShareEnabled(user.uid, currentChartId, !enabled)
      setShareConfig(next)
    } catch (e) {
      console.error('toggle share failed', e)
      alert('共有設定の変更に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('新しいURLを発行します。古いURLは使えなくなります。よろしいですか？')) return
    setBusy(true)
    try {
      const next = await regenerateShareToken(user.uid, currentChartId)
      setShareConfig(next)
    } catch (e) {
      console.error('regenerate failed', e)
      alert('再発行に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // フォールバック
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
      />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(440px, 92vw)',
          background: 'white', borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
          zIndex: 41,
          padding: 24,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#1F2937' }}>
            🔗 共有リンク
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#9CA3AF', lineHeight: 1, padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
          有効にすると、URL を知っている人なら誰でもログイン不要で
          組織図を <strong>読み取り専用</strong> で閲覧できます。
        </p>

        {/* ON/OFF トグル */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 10,
          background: enabled ? '#ECFDF5' : '#F9FAFB',
          border: `1px solid ${enabled ? '#A7F3D0' : '#E5E7EB'}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
              共有 {enabled ? '有効' : '無効'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              {enabled ? 'リンクを知っている人が閲覧できます' : 'リンクは無効です'}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={busy}
            style={{
              width: 48, height: 26, borderRadius: 999, border: 'none',
              background: enabled ? '#10B981' : '#D1D5DB',
              cursor: busy ? 'wait' : 'pointer', position: 'relative',
              transition: 'background 0.15s',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: enabled ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: 'white', transition: 'left 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
            }} />
          </button>
        </div>

        {/* URL 表示 */}
        {enabled && url && (
          <>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>
                共有 URL
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={url}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8,
                    border: '1px solid #D1D5DB', fontSize: 12,
                    fontFamily: 'monospace', color: '#374151',
                    background: '#F9FAFB', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: copied ? '#10B981' : '#7C3AED', color: 'white',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? '✓ コピー済み' : 'コピー'}
                </button>
              </div>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={busy}
              style={{
                fontSize: 12, color: '#6B7280', background: 'none',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                textDecoration: 'underline', padding: 0,
                opacity: busy ? 0.5 : 1,
              }}
            >
              新しい URL を発行（古いURLは使えなくなります）
            </button>
          </>
        )}
      </div>
    </>
  )
}
