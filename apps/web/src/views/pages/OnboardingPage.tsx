import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Profile } from '@devbord/shared';
import { Button, Field, Input } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { usePreferences } from '../../controllers/preferencesController';
import { buildBoardFromTemplate, getTemplate, templatesFor } from '../../templates';
import { Logo } from '../components/Logo';
import { ProfilePicker, TemplatePicker } from '../components/Pickers';

const STEPS = ['Perfil', 'Plantilla', 'Nombre'] as const;

/**
 * First-run flow: 3 short steps, every one with a sensible default, and a
 * "skip" exit at all times. The goal is a useful board in under 10 seconds.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const addBoard = useBoardController((s) => s.addBoard);
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>('simple');
  const [templateId, setTemplateId] = useState(templatesFor('simple')[0]!.id);
  const [name, setName] = useState('');
  const template = getTemplate(templateId);

  const changeProfile = (p: Profile) => {
    setProfile(p);
    setTemplateId(templatesFor(p)[0]!.id);
  };

  const finish = async () => {
    if (!template) return;
    const board = await addBoard(buildBoardFromTemplate(template, { name, profile }));
    completeOnboarding(profile);
    navigate(`/b/${board.id}`, { replace: true });
  };

  const skip = () => {
    completeOnboarding(profile);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Logo />
        <Button variant="ghost" size="sm" onClick={skip}>
          Saltar
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-10">
        {/* Pixel progress: one block per step. */}
        <ol className="flex gap-2" aria-label="Progreso">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-1.5">
              <span className={i <= step ? 'h-2 bg-accent' : 'h-2 bg-line-soft'} />
              <span
                className={i === step ? 'text-xs font-semibold' : 'text-xs text-muted'}
                aria-current={i === step ? 'step' : undefined}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <section key={step} className="flex animate-pixel-pop flex-col gap-5">
          {step === 0 && (
            <>
              <div>
                <h1 className="text-3xl sm:text-4xl">Hola. Organicemos algo.</h1>
                <p className="mt-2 text-muted">
                  ¿Cómo prefieres trabajar? Puedes cambiarlo cuando quieras en cada tablero.
                </p>
              </div>
              <ProfilePicker value={profile} onChange={changeProfile} />
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h1 className="text-3xl">Elige un punto de partida</h1>
                <p className="mt-2 text-muted">
                  Incluye tarjetas de ejemplo para que aprendas jugando.
                </p>
              </div>
              <TemplatePicker
                templates={templatesFor(profile)}
                value={templateId}
                onChange={setTemplateId}
              />
            </>
          )}

          {step === 2 && (
            <form
              id="onboarding-name"
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                void finish();
              }}
            >
              <div>
                <h1 className="text-3xl">Ponle nombre</h1>
                <p className="mt-2 text-muted">O déjalo así. Se puede cambiar luego.</p>
              </div>
              <Field label="Nombre del tablero" htmlFor="onboarding-board-name">
                <Input
                  id="onboarding-board-name"
                  autoFocus
                  maxLength={80}
                  placeholder={template?.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </form>
          )}
        </section>

        <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Atrás
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" form="onboarding-name" variant="primary">
              Crear mi tablero
            </Button>
          )}
        </footer>
      </main>
    </div>
  );
}
