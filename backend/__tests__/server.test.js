const request = require('supertest');
const app = require('../server');

describe('Meeting Bot API', () => {
  describe('GET /', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('meeting-bot-backend');
    });
  });

  describe('POST /api/join', () => {
    it('should return error for missing meeting_url', async () => {
      const res = await request(app)
        .post('/api/join')
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.status).toBe('error');
    });

    it('should return error for invalid meeting_url', async () => {
      const res = await request(app)
        .post('/api/join')
        .send({ meeting_url: 'invalid-url' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.status).toBe('error');
    });

    it('should return error for unsupported platform', async () => {
      const res = await request(app)
        .post('/api/join')
        .send({ meeting_url: 'https://example.com/meeting' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.status).toBe('error');
    });
  });
});