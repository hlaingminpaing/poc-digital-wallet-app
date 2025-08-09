const request = require('supertest');
const { app, pool } = require('../server');

describe('Transactions Service API', () => {
  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    jest.spyOn(pool, 'getConnection').mockResolvedValue(mockConnection);
    // For direct pool.query calls
    jest.spyOn(pool, 'query').mockImplementation((...args) => mockConnection.query(...args));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    pool.end();
  });

  describe('POST /transactions', () => {
    it('should return 400 if required data is missing', async () => {
      const res = await request(app)
        .post('/transactions')
        .send({ userId: 1, type: 'deposit' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual('Missing required transaction data.');
    });

    it('should return 201 when transaction is recorded', async () => {
      mockConnection.query.mockResolvedValueOnce([{}]);
      const res = await request(app)
        .post('/transactions')
        .send({ userId: 1, type: 'deposit', amount: 100 });
      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toEqual('Transaction recorded.');
    });
  });

  describe('GET /history/:userId', () => {
    it('should return 200 and transaction history', async () => {
      const mockHistory = [
        { id: 1, type: 'deposit', amount: 100, timestamp: new Date().toISOString(), relatedUserFullName: null },
        { id: 2, type: 'withdrawal', amount: 50, timestamp: new Date().toISOString(), relatedUserFullName: null },
      ];
      mockConnection.query.mockResolvedValueOnce([mockHistory]);
      const res = await request(app).get('/history/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockHistory);
    });
  });
});
