import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PROFILE_INFO } from '@devbord/shared';
import { Badge, Button, PixelIcon } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { TopBar } from '../components/TopBar';
import { NewBoardModal } from '../components/NewBoardModal';

const updatedFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** Home: grid of the user's boards plus a "new board" entry point. */
export function BoardsPage() {
  const boards = useBoardController((s) => s.boards);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <TopBar />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Tus tableros</h1>
            <p className="mt-1 text-muted">Todo lo que tienes entre manos, en un vistazo.</p>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <PixelIcon name="plus" />
            Nuevo tablero
          </Button>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const cards = b.columns.reduce((n, c) => n + c.cards.length, 0);
            return (
              <li key={b.id}>
                <Link
                  to={`/b/${b.id}`}
                  className="flex h-full flex-col gap-3 bg-surface p-4 pixel-raised transition-transform hover:-translate-y-0.5"
                >
                  {/* Mini preview: one bar per column, height by card count. */}
                  <div className="flex h-12 items-end gap-1" aria-hidden>
                    {b.columns.slice(0, 6).map((c) => (
                      <span
                        key={c.id}
                        className="flex-1 bg-surface-2"
                        style={{ height: `${Math.min(100, 25 + c.cards.length * 15)}%` }}
                      />
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
    </div>
  );
}
