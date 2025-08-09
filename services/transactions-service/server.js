const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const client = require('prom-client');

const app = express();
const port = 3003;

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [50, 100, 200, 300, 400, 500, 750, 1000, 2000]
});
register.registerMetric(httpRequestDurationMicroseconds);

app.use(bodyParser.json());
app.use(cors());

// Middleware to measure request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ route: req.path, code: res.statusCode, method: req.method });
  });
  next();
});

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'digital_wallet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('Transactions service connected to database.');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        type ENUM('deposit', 'withdrawal', 'transfer_out', 'transfer_in') NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        relatedUserId INT NULL, -- For transfers, this links to the other user
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (relatedUserId) REFERENCES users(id)
      )
    `);
    console.log('Transactions table created or already exists.');
    
    connection.release();
  } catch (err) {
    console.error('Error initializing transactions database:', err);
    setTimeout(initializeDatabase, 5000);
  }
}

// API endpoint to record a new transaction
app.post('/transactions', async (req, res) => {
  const { userId, type, amount, relatedUserId = null } = req.body;

  if (!userId || !type || !amount) {
    return res.status(400).json({ message: 'Missing required transaction data.' });
  }

  try {
    await pool.query(
      'INSERT INTO transactions (userId, type, amount, relatedUserId) VALUES (?, ?, ?, ?)',
      [userId, type, amount, relatedUserId]
    );
    res.status(201).json({ message: 'Transaction recorded.' });
  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// API endpoint to get transaction history for a user
app.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [transactions] = await pool.query(
      `SELECT t.id, t.type, t.amount, t.timestamp, u_related.fullName as relatedUserFullName
       FROM transactions t
       LEFT JOIN users u_related ON t.relatedUserId = u_related.id
       WHERE t.userId = ? 
       ORDER BY t.timestamp DESC`,
      [userId]
    );
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Transactions service listening at http://localhost:${port}`);
    initializeDatabase();
  });
}

module.exports = { app, pool };