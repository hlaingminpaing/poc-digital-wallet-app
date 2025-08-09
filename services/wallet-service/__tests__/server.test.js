const request = require('supertest');
const { app, pool } = require('../server');
const axios = require('axios');

jest.mock('axios');

describe('Wallet Service API', () => {
  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    jest.spyOn(pool, 'getConnection').mockResolvedValue(mockConnection);
    jest.spyOn(pool, 'query').mockImplementation((...args) => mockConnection.query(...args));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    pool.end();
  });

  describe('GET /balance/:userId', () => {
    it('should return 404 if wallet not found', async () => {
      mockConnection.query.mockResolvedValue([[]]);
      const res = await request(app).get('/balance/1');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 200 with balance', async () => {
      mockConnection.query.mockResolvedValue([[{ balance: 100 }]]);
      const res = await request(app).get('/balance/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body.balance).toEqual(100);
    });
  });

  describe('POST /deposit', () => {
    it('should return 200 for successful deposit', async () => {
      mockConnection.query.mockResolvedValue([{}]);
      axios.post.mockResolvedValue({});
      const res = await request(app)
        .post('/deposit')
        .send({ userId: 1, amount: 50 });
      expect(res.statusCode).toEqual(200);
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('POST /withdraw', () => {
    it('should return 400 for insufficient funds', async () => {
      mockConnection.query.mockResolvedValue([[{ balance: 20 }]]);
      const res = await request(app)
        .post('/withdraw')
        .send({ userId: 1, amount: 50 });
      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 for successful withdrawal', async () => {
      mockConnection.query.mockResolvedValueOnce([[{ balance: 100 }]]); // SELECT
      mockConnection.query.mockResolvedValueOnce([{}]); // UPDATE
      axios.post.mockResolvedValue({});
      const res = await request(app)
        .post('/withdraw')
        .send({ userId: 1, amount: 50 });
      expect(res.statusCode).toEqual(200);
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('POST /wallets/update-balance', () => {
    it('should return 400 for insufficient funds', async () => {
        mockConnection.query.mockResolvedValueOnce([[{ balance: 20 }]]); // fromUser
        const res = await request(app)
            .post('/wallets/update-balance')
            .send({ fromUserId: 1, toUserId: 2, amount: 100 });
        expect(res.statusCode).toEqual(400);
    });

    it('should return 200 for successful update', async () => {
        mockConnection.query.mockResolvedValueOnce([[{ balance: 200 }]]); // fromUser
        mockConnection.query.mockResolvedValueOnce([{}]); // update fromUser
        mockConnection.query.mockResolvedValueOnce([{}]); // update toUser
        const res = await request(app)
            .post('/wallets/update-balance')
            .send({ fromUserId: 1, toUserId: 2, amount: 100 });
        expect(res.statusCode).toEqual(200);
    });
  });
});
