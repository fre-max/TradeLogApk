import { describe, it, expect, beforeEach } from 'vitest';
import { usePinStore } from '@/store/usePinStore';

describe('usePinStore - Gestion du code PIN et du verrouillage', () => {
  // Avant chaque test, on remet le store dans un état neutre
  beforeEach(() => {
    usePinStore.setState({
      pin: null,
      isUnlocked: false,
    });
  });

  // 1️⃣ Test de l'état par défaut
  it('doit être verrouillé et sans PIN par défaut', () => {
    const etat = usePinStore.getState();

    expect(etat.pin).toBeNull();
    expect(etat.isUnlocked).toBe(false);
  });

  // 2️⃣ Test de mise à jour du code PIN
  it('doit permettre de définir un nouveau code PIN', () => {
    // Action : Définition d'un code PIN à 4 chiffres
    usePinStore.getState().setPin('1234');

    // Vérification : Le code a bien été enregistré dans le store
    expect(usePinStore.getState().pin).toBe('1234');
  });

  // 3️⃣ Test de déverrouillage
  it('doit déverrouiller l application avec la fonction unlock()', () => {
    // Action : Déverrouillage
    usePinStore.getState().unlock();

    // Vérification : isUnlocked doit passer à true
    expect(usePinStore.getState().isUnlocked).toBe(true);
  });

  // 4️⃣ Test de re-verrouillage
  it('doit reverrouiller l application avec la fonction lock()', () => {
    // On met d'abord le store à l'état déverrouillé
    usePinStore.setState({ isUnlocked: true });

    // Action : Verrouillage
    usePinStore.getState().lock();

    // Vérification : isUnlocked doit repasser à false
    expect(usePinStore.getState().isUnlocked).toBe(false);
  });
});
