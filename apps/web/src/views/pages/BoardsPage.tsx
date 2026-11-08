import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PROFILE_INFO } from '@devbord/shared';
import { Badge, Button, PixelIcon } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { AppShell } from '../components/AppShell';
import { NewBoardModal } from '../components/NewBoardModal';

const updatedFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** Home: grid of the user's boards plus a "new board" entry point. */
export function BoardsPage() {
  const boards = useBoardController((s) => s.boards);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <AppShell>
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-4 px-4 pt-8 pb-6">
        <div>
          <h1 className="text-3xl">Tus tableros</h1>
          <p className="mt-1 text-muted">Todo lo que tienes entre manos, en un vistazo.</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <PixelIcon name="plus" />
          Nuevo tablero
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <ul className="mx-auto grid max-w-5xl gap-5 px-4 pb-8 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const cards = b.columns.reduce((n, c) => n + c.cards.length, 0);
            return (
              <li key={b.id}>
                <Link
                  to={`/b/${b.id}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-line-soft bg-card p-4 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift"
                >
                  {/* Mini preview: one column per bar, filled with pixel blocks (one per card). */}
                  <div className="flex h-14 gap-1.5 rounded-lg bg-surface-2 p-1.5" aria-hidden>
                    {b.columns.slice(0, 6).map((c) => (
                      <span key={c.id} className="flex flex-1 flex-col gap-1">
                        {Array.from({ length: Math.min(4, c.cards.length) }, (_, i) => (
                          <span key={i} className="h-2 rounded-[2px] bg-card shadow-card" />
                        ))}
                      </span>
                    ))}
                  </div>
                  <h2 className="truncate text-lg">{b.name}</h2>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted">
                    <Badge color={b.profile === 'technical' ? 'blue' : 'green'}>
                      {PROFILE_INFO[b.profile].title}
                    </Badge>
                    <span>
                      {cards} tarjetas · {updatedFormat.format(new Date(b.updatedAt))}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {boards.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
            <PixelIcon name="board" size={48} />
            <p>Aún no tienes tableros. Crea el primero en segundos.</p>
          </div>
        )}
      </main>

      <NewBoardModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/b/${id}`)}
      />
    </AppShell>
  );
}
