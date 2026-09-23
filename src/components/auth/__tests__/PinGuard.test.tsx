import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PinGuard } from '@/components/auth/PinGuard';
import { usePinStore } from '@/store/usePinStore';
import { useUIStore } from '@/store';

describe('Composant PinGuard - Protection par code PIN', () => {
  beforeEach(() => {
    // Réinitialisation des stores avant chaque test
    usePinStore.setState({
      pin: null,
      isUnlocked: false,
    });
    useUIStore.setState({
      toasts: [],
    });
  });

  // 1️⃣ Aucun PIN configuré
  it('affiche directement le contenu si aucun code PIN n est configuré', () => {
    render(
      <PinGuard>
        <div>Contenu Secret du Journal</div>
      </PinGuard>
    );

    // Le contenu protégé doit être visible immédiatement
    expect(screen.getByText('Contenu Secret du Journal')).toBeInTheDocument();
  });

  // 2️⃣ PIN configuré et application verrouillée
  it('bloque l affichage et demande le code PIN lorsque le store est verrouillé', () => {
    usePinStore.setState({
      pin: '1234',
      isUnlocked: false,
    });

    render(
      <PinGuard>
        <div>Contenu Secret du Journal</div>
      </PinGuard>
    );

    // Le contenu secret ne doit PAS être dans l'écran
    expect(screen.queryByText('Contenu Secret du Journal')).not.toBeInTheDocument();
    // Le titre de demande de PIN doit être affiché
    expect(screen.getByText('Entrez votre code PIN')).toBeInTheDocument();
  });

  // 3️⃣ Saisie du bon code PIN
  it('déverrouille et affiche le contenu lors de la saisie des 4 bons chiffres', async () => {
    const user = userEvent.setup();

    usePinStore.setState({
      pin: '1234',
      isUnlocked: false,
    });

    const { rerender } = render(
      <PinGuard>
        <div>Contenu Secret du Journal</div>
      </PinGuard>
    );

    // Clic sur les touches 1, 2, 3, 4
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: '4' }));

    // Vérification : Le store doit être déverrouillé
    expect(usePinStore.getState().isUnlocked).toBe(true);

    // Après mise à jour de l'état, le contenu secret est rendu
    rerender(
      <PinGuard>
        <div>Contenu Secret du Journal</div>
      </PinGuard>
    );
    expect(screen.getByText('Contenu Secret du Journal')).toBeInTheDocument();
  });

  // 4️⃣ Saisie d'un mauvais code PIN
  it('ajoute une alerte toast d erreur si le code PIN est erroné', async () => {
    const user = userEvent.setup();

    usePinStore.setState({
      pin: '1234',
      isUnlocked: false,
    });

    render(
      <PinGuard>
        <div>Contenu Secret du Journal</div>
      </PinGuard>
    );

    // Saisie d'un faux code : 9, 9, 9, 9
    const boutonNeuf = screen.getByRole('button', { name: '9' });
    await user.click(boutonNeuf);
    await user.click(boutonNeuf);
    await user.click(boutonNeuf);
    await user.click(boutonNeuf);

    // Le store reste verrouillé
    expect(usePinStore.getState().isUnlocked).toBe(false);

    // Un toast d'erreur a été déclenché dans useUIStore
    const toasts = useUIStore.getState().toasts;
    expect(toasts.some((t) => t.message === 'Code PIN incorrect' && t.type === 'error')).toBe(true);
  });
});
