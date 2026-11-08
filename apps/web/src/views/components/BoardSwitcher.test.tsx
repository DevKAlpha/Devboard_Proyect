import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardController } from '../../controllers/boardController';
import { BoardSwitcher } from './BoardSwitcher';

const BoardRoute = () => {
  const { id } = useParams();
  return (
    <>
      <p>Tablero actual: {id}</p>
      <BoardSwitcher currentId={id!} />
    </>
  );
};

describe('BoardSwitcher', () => {
  beforeEach(async () => {
    useBoardController.setState({ boards: [] });
    const { createBoard } = useBoardController.getState();
    await createBoard({ name: 'Sprint', profile: 'technical' });
    await createBoard({ name: 'Casa', profile: 'simple' });
  });

  const renderAt = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/b/${id}`]}>
        <Routes>
          <Route path="/" element={<p>Lista de tableros</p>} />
          <Route path="/b/:id" element={<BoardRoute />} />
        </Routes>
      </MemoryRouter>,
    );

  it('switches to another board from the list', async () => {
    const [first, second] = useBoardController.getState().boards;
    renderAt(first!.id);
    await userEvent.selectOptions(screen.getByLabelText('Cambiar de tablero'), second!.id);
    expect(screen.getByText(`Tablero actual: ${second!.id}`)).toBeInTheDocument();
  });

  it('can jump back to the full board list', async () => {
    renderAt(useBoardController.getState().boards[0]!.id);
    await userEvent.selectOptions(screen.getByLabelText('Cambiar de tablero'), '__all__');
    expect(screen.getByText('Lista de tableros')).toBeInTheDocument();
  });
});
