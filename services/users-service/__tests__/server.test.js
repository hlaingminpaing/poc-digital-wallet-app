const request = require('supertest');
const { app, pool } = require('../server'); // Import your app and the pool

describe('User Service API', () => {
  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    // Now that we import the pool, we can mock its getConnection method
    jest.spyOn(pool, 'getConnection').mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    pool.end(); // Close the pool after all tests
  });

  describe('POST /register', () => {
    it('should return 400 if fullName is missing', async () => {
      const res = await request(app)
        .post('/register')
        .send({ email: 'test@test.com', password: 'password' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual('All fields are required.');
    });

    it('should return 409 if user already exists', async () => {
      mockConnection.query.mockResolvedValueOnce([[{ id: 1 }]]); // existingUsers
      const res = await request(app)
        .post('/register')
        .send({ fullName: 'Test User', email: 'test@test.com', password: 'password' });
      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toEqual('User with this email already exists.');
    });

    it('should return 201 if user is created successfully', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[]]) // existingUsers
        .mockResolvedValueOnce([{ insertId: 1 }]) // result
        .mockResolvedValueOnce([[]]); // wallet insert

      const res = await request(app)
        .post('/register')
        .send({ fullName: 'Test User', email: 'test@test.com', password: 'password' });

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toEqual('User registered successfully!');
      expect(res.body.userId).toEqual(1);
    });
  });
});
