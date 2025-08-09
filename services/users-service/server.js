const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const client = require('prom-client');

const app = express();
const port = 3001;

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
    console.log('Connected to database');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL, -- In a real app, this should be hashed
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created or already exists.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
    console.log('Wallets table created or already exists.');

    connection.release();
  } catch (err) {
    console.error('Error initializing database:', err);
    setTimeout(initializeDatabase, 5000);
  }
}

// API endpoint for user registration
app.post('/register', async (req, res) => {
  let { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  // Trim whitespace from email
  email = email.trim();

  try {
    const connection = await pool.getConnection();
    
    const [existingUsers] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      connection.release();
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    const [result] = await connection.query('INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)', [fullName, email, password]);
    const newUserId = result.insertId;

    await connection.query('INSERT INTO wallets (userId, balance) VALUES (?, ?)', [newUserId, 0.00]);
    
    connection.release();

    res.status(201).json({ message: 'User registered successfully!', userId: newUserId });

  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// API endpoint for user login
app.post('/login', async (req, res) => {
    let { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Trim whitespace from email
    email = email.trim();

    try {
        const connection = await pool.getConnection();
        const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        connection.release();

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }

        const user = users[0];

        // In a real app, you would use bcrypt.compare(password, user.password)
        if (password !== user.password) {
            return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
        }

        // Don't send the password back to the client
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({ message: 'Login successful!', user: userWithoutPassword });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// API endpoint to validate user existence for transfers
app.get('/users/validate', async (req, res) => {
    let { email } = req.query;

    if (!email) {
        return res.status(400).json({ message: 'Email is required for validation.' });
    }
    
    // Trim whitespace from email
    email = email.trim();

    try {
        const connection = await pool.getConnection();
        const [users] = await connection.query('SELECT id, fullName FROM users WHERE email = ?', [email]);
        connection.release();

        if (users.length > 0) {
            res.status(200).json({ exists: true, user: users[0] });
        } else {
            res.status(404).json({ exists: false, message: 'User not found.' });
        }
    } catch (error) {
        console.error('Error during user validation:', error);
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
    console.log(`Users service listening at http://localhost:${port}`);
    initializeDatabase();
  });
}

module.exports = { app, pool };