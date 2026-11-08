import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardController } from '../../controllers/boardController';
import { BoardCanvas } from './BoardCanvas';

const renderBoard = () => {
  const board = useBoardController.getState().boards[0]!;
  return render(<BoardCanvas board={board} />);
};

describe('BoardCanvas', () => {
  beforeEach(async () => {
    useBoardController.setState({ boards: [] });
    await useBoardController
      .getState()
      .createBoard({ name: 'Demo', profile: 'simple', columnTitles: ['Por hacer', 'Hecho'] });
  });

  it('renders one region per column', () => {
    renderBoard();
    expect(screen.getByRole('region', { name: 'Columna Por hacer' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Columna Hecho' })).toBeInTheDocument();
  });

  it('adds a card through the inline composer', async () => {
    const { rerender } = renderBoard();
    const column = screen.getByRole('region', { name: 'Columna Por hacer' });
    await userEvent.click(within(column).getByRole('button', { name: /Añadir tarjeta/ }));
    await userEvent.type(within(column).getByRole('textbox'), 'Comprar café{Enter}');

    rerender(<BoardCanvas board={useBoardController.getState().boards[0]!} />);
    expect(screen.getByText('Comprar café')).toBeInTheDocument();
  });
});
