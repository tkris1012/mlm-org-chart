import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import {
  logout,
  switchAccount,
  getRecentAccounts,
  removeRecentAccount,
} from '../../lib/auth.js'

function Avatar({ photoURL, displayName, email, size = 32 }) {
  const initial = (displayName || email || '?').trim().charAt(0).toUpperCase()
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt="avatar"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#7C3AED', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700,
    }}>
      {initial}
    </div>
  )
}

export default function AccountMenu() {
  const user = useStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState(() => getRecentAccounts())

  if (!user) return null

  const others = accounts.filter((a) => a.uid !== user.uid)

  async function handleSwitch(email) {
    setOpen(false)
    try { await switchAccount(email) } catch (e) { console.error('アカウント切替に失敗:', e) }
  }
  async function handleAdd() {
    setOpen(false)
    try { await switchAccount() } catch (e) { console.error('アカウント追加に失敗:', e) }
  }
  async function handleLogout() {
    setOpen(false)
    try { await logout() } catch (e) { console.error('ログアウトに失敗:', e) }
  }
  function handleRemove(e, uid) {
    e.stopPropagation()
    removeRecentAccount(uid)
    setAccounts(getRecentAccounts())
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* アバターボタン */}
      <button
        onClick={() => { setAccounts(getRecentAccounts()); setOpen((o) => !o) }}
        title="アカウント"
        style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
          border: '1px solid #E5E7EB', cursor: 'pointer', padding: 0,
          background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Avatar photoURL={user.photoURL} displayName={user.displayName} email={user.email} size={34} />
      </button>

      {open && (
        <>
          {/* クリック外しオーバーレイ */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />

          {/* ドロップダウン */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 44, right: 0,
              background: 'white', borderRadius: 12,
              boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
              border: '1px solid #E5E7EB',
              width: 280, zIndex: 41, overflow: 'hidden',
            }}
          >
            {/* 現在のアカウント */}
            <div style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: '1px solid #F0F0F0',
            }}>
              <Avatar photoURL={user.photoURL} displayName={user.displayName} email={user.email} size={40} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: '#1F2937',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.displayName || '（名前なし）'}
                </div>
                <div style={{
                  fontSize: 12, color: '#6B7280',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.email}
                </div>
              </div>
            </div>

            {/* 他アカウントへ切替 */}
            {others.length > 0 && (
              <div style={{ borderBottom: '1px solid #F0F0F0', padding: '6px 0' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, padding: '4px 16px' }}>
                  アカウントを切り替え
                </div>
                {others.map((a) => (
                  <div
                    key={a.uid}
                    onClick={() => handleSwitch(a.email)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 16px', cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                  >
                    <Avatar photoURL={a.photoURL} displayName={a.displayName} email={a.email} size={28} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 13, color: '#374151', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {a.displayName || a.email}
                      </div>
                      {a.displayName && (
                        <div style={{
                          fontSize: 11, color: '#9CA3AF',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.email}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleRemove(e, a.uid)}
                      title="履歴から削除"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: '#9CA3AF', fontSize: 16, lineHeight: 1, padding: 4,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* アクション */}
            <div style={{ padding: '6px 0' }}>
              <button
                onClick={handleAdd}
                style={menuItemStyle('#374151')}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
              >
                ＋ 別のアカウントを追加
              </button>
              <button
                onClick={handleLogout}
                style={menuItemStyle('#EF4444')}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
              >
                ↩ ログアウト
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function menuItemStyle(color) {
  return {
    display: 'block', width: '100%', padding: '10px 16px',
    textAlign: 'left', border: 'none', background: 'white',
    cursor: 'pointer', fontSize: 13, color, fontWeight: 500,
  }
}
