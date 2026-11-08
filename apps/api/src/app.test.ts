import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createBoard } from '@devbord/shared';
import { createApp } from './app';

describe('api', () => {
  it('reports health', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('upserts, reads, lists and deletes a board', async () => {
    const app = createApp();
    const board = createBoard({ name: 'API', profile: 'technical', columnTitles: ['To Do'] });

    expect((await request(app).put(`/api/boards/${board.id}`).send(board)).status).toBe(200);
    expect((await request(app).get(`/api/boards/${board.id}`)).body).toEqual(board);
    expect((await request(app).get('/api/boards')).body).toHaveLength(1);
    expect((await request(app).delete(`/api/boards/${board.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/boards/${board.id}`)).status).toBe(404);
  });

  it('rejects invalid bodies and id mismatches', async () => {
    const app = createApp();
    const board = createBoard({ name: 'X', profile: 'simple' });
    const invalid = await request(app).put(`/api/boards/${board.id}`).send({ name: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
    expect((await request(app).put('/api/boards/other').send(board)).body.error.code).toBe(
      'id_mismatch',
    );
  });
});
