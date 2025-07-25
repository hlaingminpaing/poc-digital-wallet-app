const request = require('supertest');
const app = require('../server');
const axios = require('axios');

jest.mock('axios');

describe('Transfer Service API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /transfer', () => {
    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/transfer')
        .send({ fromUserId: 1, toUserEmail: 'test@test.com' });
      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 if recipient is not found', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });
      const res = await request(app)
        .post('/transfer')
        .send({ fromUserId: 1, toUserEmail: 'notfound@test.com', amount: 100 });
      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 if sender and recipient are the same', async () => {
      axios.get.mockResolvedValue({ data: { user: { id: 1 } } });
      const res = await request(app)
        .post('/transfer')
        .send({ fromUserId: 1, toUserEmail: 'self@test.com', amount: 100 });
      expect(res.statusCode).toEqual(400);
    });

    it('should return an error if wallet service fails', async () => {
      axios.get.mockResolvedValue({ data: { user: { id: 2 } } });
      axios.post.mockRejectedValue({ response: { status: 400, data: { message: 'Insufficient funds' } } });
      const res = await request(app)
        .post('/transfer')
        .send({ fromUserId: 1, toUserEmail: 'recipient@test.com', amount: 100 });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Insufficient funds');
    });

    it('should return 200 for a successful transfer', async () => {
      axios.get.mockResolvedValue({ data: { user: { id: 2 } } });
      axios.post.mockResolvedValue({ status: 200 });
      const res = await request(app)
        .post('/transfer')
        .send({ fromUserId: 1, toUserEmail: 'recipient@test.com', amount: 100 });
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toEqual('Transfer completed successfully!');
      // Check that the transaction recording calls were made
      expect(axios.post).toHaveBeenCalledTimes(3); // 1 for wallet, 2 for transactions
    });
  });
});
