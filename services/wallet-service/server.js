const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3001; // All services will run on 3001 inside the container

app.use(bodyParser.json());
app.use(cors());

// Database connection settings from environment variables
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

// Helper function to check DB connection
async function checkDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Wallet service connected to database.');
        connection.release();
    } catch (error) {
        console.error('Wallet service failed to connect to database:', error);
        setTimeout(checkDbConnection, 5000); // Retry
    }
}

// API endpoint to get wallet balance
app.get('/balance/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query('SELECT balance FROM wallets WHERE userId = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }
    res.status(200).json({ balance: rows[0].balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// API endpoint for depositing funds
app.post('/deposit', async (req, res) => {
  const { userId, amount } = req.body;
  const depositAmount = parseFloat(amount);

  if (!userId || !depositAmount || depositAmount <= 0) {
    return res.status(400).json({ message: 'Valid userId and positive amount are required.' });
  }

  try {
    await pool.query('UPDATE wallets SET balance = balance + ? WHERE userId = ?', [depositAmount, userId]);
    res.status(200).json({ message: 'Deposit successful.' });
  } catch (error) {
    console.error('Error during deposit:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// API endpoint for withdrawing funds
app.post('/withdraw', async (req, res) => {
  const { userId, amount } = req.body;
  const withdrawAmount = parseFloat(amount);

  if (!userId || !withdrawAmount || withdrawAmount <= 0) {
    return res.status(400).json({ message: 'Valid userId and positive amount are required.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [rows] = await connection.query('SELECT balance FROM wallets WHERE userId = ? FOR UPDATE', [userId]);
    
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    const currentBalance = parseFloat(rows[0].balance);
    if (currentBalance < withdrawAmount) {
      await connection.rollback();
      return res.status(400).json({ message: 'Insufficient funds.' });
    }

    await connection.query('UPDATE wallets SET balance = balance - ? WHERE userId = ?', [withdrawAmount, userId]);
    await connection.commit();
    
    res.status(200).json({ message: 'Withdrawal successful.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error during withdrawal:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// Internal endpoint for transfer service to update balances
app.post('/wallets/update-balance', async (req, res) => {
    const { fromUserId, toUserId, amount } = req.body;
    const transferAmount = parseFloat(amount);

    if (!fromUserId || !toUserId || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ message: 'Invalid transfer data.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Lock sender's wallet and check balance
        const [senderWallet] = await connection.query('SELECT balance FROM wallets WHERE userId = ? FOR UPDATE', [fromUserId]);
        if (senderWallet.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Sender wallet not found.' });
        }
        if (parseFloat(senderWallet[0].balance) < transferAmount) {
            await connection.rollback();
            return res.status(400).json({ message: 'Insufficient funds.' });
        }

        // Debit sender
        await connection.query('UPDATE wallets SET balance = balance - ? WHERE userId = ?', [transferAmount, fromUserId]);
        // Credit receiver
        await connection.query('UPDATE wallets SET balance = balance + ? WHERE userId = ?', [transferAmount, toUserId]);

        await connection.commit();
        res.status(200).json({ message: 'Balance update successful.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating balances for transfer:', error);
        res.status(500).json({ message: 'Internal server error during balance update.' });
    } finally {
        connection.release();
    }
});


app.listen(port, () => {
  console.log(`Wallet service listening at http://localhost:${port}`);
  checkDbConnection();
});