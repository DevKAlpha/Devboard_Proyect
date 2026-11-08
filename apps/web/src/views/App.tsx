import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { useBoardController } from '../controllers/boardController';
import { usePreferences } from '../controllers/preferencesController';
import { PixelCursor } from './cursor/PixelCursor';
import { BoardPage } from './pages/BoardPage';
import { BoardsPage } from './pages/BoardsPage';
import { OnboardingPage } from './pages/OnboardingPage';

/** First-time visitors with no boards land on onboarding instead of an empty home. */
function HomeRoute() {
  const onboarded = usePreferences((s) => s.onboarded);
  const hasBoards = useBoardController((s) => s.boards.length > 0);
  return onboarded || hasBoards ? <BoardsPage /> : <Navigate to="/welcome" replace />;
}

/**
 * Root view: loads data once, then routes.
 * HashRouter is deliberate: GitHub Pages cannot rewrite deep links to
 * index.html, so `/#/b/123` survives a reload where `/b/123` would 404.
 */
export function App() {
  const status = useBoardController((s) => s.status);
  const error = useBoardController((s) => s.error);

  useEffect(() => {
    void useBoardController.getState().load();
  }, []);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="grid h-full place-items-center font-pixel text-muted" role="status">
        Cargando…
      </div>
    );
  }

  return (
    <HashRouter>
      <PixelCursor />
      {error && (
        <div role="alert" className="bg-danger px-4 py-2 text-center text-sm text-white">
          {error}
        </div>
      )}
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="/b/:boardId" element={<BoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
