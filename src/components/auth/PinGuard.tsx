import { useState, useEffect } from 'react';
import { usePinStore } from '@/store/usePinStore';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store';

export function PinGuard({ children }: { children: React.ReactNode }) {
  const { pin, isUnlocked, unlock, setPin } = usePinStore();
  const [inputPin, setInputPin] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const addToast = useUIStore((state) => state.addToast);

  useEffect(() => {
    // Si l'utilisateur a fini de taper les 4 chiffres
    if (inputPin.length === 4) {
      if (inputPin === pin) {
        unlock();
        setInputPin('');
      } else {
        addToast('Code PIN incorrect', 'error');
        setInputPin('');
      }
    }
  }, [inputPin, pin, unlock, addToast]);

  const handleForgotLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      addToast(error.message, 'error');
      return;
    }

    if (data.session) {
      // Récupération du PIN depuis les métadonnées de l'utilisateur (Supabase)
      const cloudPin = data.user.user_metadata?.pin_code;
      if (cloudPin) {
        setPin(cloudPin);
        addToast('Code PIN récupéré depuis le cloud !', 'success');
        unlock();
      } else {
        // L'utilisateur n'avait pas de PIN sur le cloud, on désactive le PIN local
        setPin(null);
        addToast('Aucun code PIN trouvé sur le cloud. PIN local désactivé.', 'success');
        unlock();
      }
      setShowForgot(false);
    }
  };

  // Si pas de PIN configuré ou déjà déverrouillé, on affiche l'app normalement
  if (!pin || isUnlocked) {
    return <>{children}</>;
  }

  // Écran "Mot de passe oublié"
  if (showForgot) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-8">
          <h2 className="text-txt text-xl font-semibold mb-6">Récupérer le PIN</h2>
          <p className="text-txt3 text-sm mb-4">
            Connectez-vous à votre compte Supabase pour récupérer votre code PIN sauvegardé.
          </p>
          <form onSubmit={handleForgotLogin} className="flex flex-col gap-4">
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
              {loading ? 'Connexion...' : 'Se connecter et récupérer'}
            </button>
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="text-txt3 text-sm mt-2 hover:text-txt"
            >
              Retour au code PIN
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Écran du code PIN
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-semibold text-sm">TL</div>
        <span className="text-txt font-semibold text-lg">TradeLog</span>
      </div>

      <h2 className="text-txt text-xl font-medium mb-8">Entrez votre code PIN</h2>
      
      {/* Affichage des points (masqués) */}
      <div className="flex gap-4 mb-12">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`w-4 h-4 rounded-full border-2 ${
              index < inputPin.length ? 'bg-accent border-accent' : 'border-border2 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Clavier numérique */}
      <div className="grid grid-cols-3 gap-6 mb-8 max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => inputPin.length < 4 && setInputPin((prev) => prev + num)}
            className="w-16 h-16 rounded-full bg-surface border border-border2 text-txt text-xl font-medium flex items-center justify-center active:bg-surface2 transition-colors"
          >
            {num}
          </button>
        ))}
        <div /> {/* Espace vide */}
        <button
          onClick={() => inputPin.length < 4 && setInputPin((prev) => prev + '0')}
          className="w-16 h-16 rounded-full bg-surface border border-border2 text-txt text-xl font-medium flex items-center justify-center active:bg-surface2 transition-colors"
        >
          0
        </button>
        <button
          onClick={() => setInputPin((prev) => prev.slice(0, -1))}
          className="w-16 h-16 rounded-full flex items-center justify-center text-txt2 active:text-txt transition-colors"
        >
          {/* Icône Delete simple */}
          ⌫
        </button>
      </div>

      <button 
        onClick={() => setShowForgot(true)}
        className="text-txt3 text-sm hover:text-txt transition-colors"
      >
        Code PIN oublié ?
      </button>
    </div>
  );
}
