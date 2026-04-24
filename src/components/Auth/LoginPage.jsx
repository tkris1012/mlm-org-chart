import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../../lib/firebase.js'

export default function LoginPage() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      console.error('ログイン失敗:', e)
    }
  }

  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-violet-50 to-violet-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-80">
        {/* Logo */}
        <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center shadow">
          <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
            <rect x="15" y="4" width="10" height="7" rx="2" fill="white"/>
            <rect x="4" y="17" width="10" height="7" rx="2" fill="white"/>
            <rect x="26" y="17" width="10" height="7" rx="2" fill="white"/>
            <rect x="4" y="30" width="10" height="7" rx="2" fill="#DDD6FE"/>
            <rect x="26" y="30" width="10" height="7" rx="2" fill="#DDD6FE"/>
            <line x1="20" y1="11" x2="20" y2="17" stroke="white" strokeWidth="1.5"/>
            <line x1="20" y1="14" x2="9" y2="17" stroke="white" strokeWidth="1.5"/>
            <line x1="20" y1="14" x2="31" y2="17" stroke="white" strokeWidth="1.5"/>
            <line x1="9" y1="24" x2="9" y2="30" stroke="white" strokeWidth="1.5"/>
            <line x1="31" y1="24" x2="31" y2="30" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">MLM Org Chart</h1>
          <p className="text-sm text-gray-500 mt-1">組織図管理アプリ</p>
        </div>

        <button
          onClick={handleLogin}
          className="flex items-center gap-3 bg-white border border-gray-300 rounded-lg px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm w-full justify-center"
        >
          <GoogleIcon />
          Googleでログイン
        </button>

        <p className="text-xs text-gray-400 text-center">
          ログインすることで、複数端末から<br />同じデータにアクセスできます。
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
