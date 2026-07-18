import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message) }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-semibold text-sm">TL</div>
          <span className="text-txt font-semibold text-lg">TradeLog</span>
        </div>

        <h1 className="text-txt text-xl font-semibold mb-6">Connexion</h1>

        {error && (
          <div className="mb-4 p-3 bg-loss/10 border border-loss/30 rounded-lg text-loss text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-txt3 text-xs uppercase tracking-wider font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-sm outline-none focus:border-accent"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-txt3 text-xs uppercase tracking-wider font-medium">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-sm outline-none focus:border-accent"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-white rounded-md py-2 text-sm font-medium hover:bg-accent/90 disabled:opacity-50 mt-2"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-txt3 text-xs">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full border border-border2 text-txt2 rounded-md py-2 text-sm font-medium hover:bg-surface2 flex items-center justify-center gap-2"
        >
          <span>🔑</span> Continuer avec Google
        </button>
      </div>
    </div>
  )
}
