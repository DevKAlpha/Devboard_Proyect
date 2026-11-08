import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('the logo takes the user back to the start screen from anywhere', async () => {
    render(
      <MemoryRouter initialEntries={['/b/some-board']}>
        <Routes>
          <Route path="/" element={<p>Pantalla inicial</p>} />
          <Route path="/b/:id" element={<AppShell>Tablero</AppShell>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('link', { name: /ir al inicio/ }));
    expect(screen.getByText('Pantalla inicial')).toBeInTheDocument();
  });
});
