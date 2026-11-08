import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { IconButton } from './IconButton';

describe('Button', () => {
  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button', { name: 'Ok' })).toHaveAttribute('type', 'button');
  });

  it('gives icon buttons an accessible name', async () => {
    const onClick = vi.fn();
    render(<IconButton icon="plus" label="Añadir" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
