const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());

const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://wallet-service:3001';
const TRANSACTIONS_SERVICE_URL = process.env.TRANSACTIONS_SERVICE_URL || 'http://transactions-service:3001';

app.post('/transfer', async (req, res) => {
    const { fromUserId, toUserEmail, amount } = req.body;
    const transferAmount = parseFloat(amount);

    if (!fromUserId || !toUserEmail || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ message: 'Valid sender ID, recipient email, and positive amount are required.' });
    }

    try {
        // 1. Validate recipient user and get their ID
        let recipient;
        try {
            const validationResponse = await axios.get(`${USERS_SERVICE_URL}/users/validate`, { params: { email: toUserEmail } });
            recipient = validationResponse.data.user;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return res.status(404).json({ message: 'Recipient user not found.' });
            }
            throw new Error('Error validating recipient: ' + (error.response?.data?.message || error.message));
        }

        const toUserId = recipient.id;
        if (fromUserId == toUserId) {
            return res.status(400).json({ message: 'Cannot transfer money to yourself.' });
        }

        // 2. Perform the wallet balance update (debit and credit)
        try {
            await axios.post(`${WALLET_SERVICE_URL}/wallets/update-balance`, {
                fromUserId,
                toUserId,
                amount: transferAmount
            });
        } catch (error) {
             // Forward the error from the wallet service
            return res.status(error.response?.status || 500).json({ message: 'Failed to update balances: ' + (error.response?.data?.message || error.message) });
        }


        // 3. Record transactions for both users (fire and forget, but can be made more robust)
        try {
            // Record outgoing transfer for sender
            axios.post(`${TRANSACTIONS_SERVICE_URL}/transactions`, {
                userId: fromUserId,
                type: 'transfer_out',
                amount: transferAmount,
                relatedUserId: toUserId
            }).catch(e => console.error('Failed to record outgoing transaction:', e.message));

            // Record incoming transfer for receiver
            axios.post(`${TRANSACTIONS_SERVICE_URL}/transactions`, {
                userId: toUserId,
                type: 'transfer_in',
                amount: transferAmount,
                relatedUserId: fromUserId
            }).catch(e => console.error('Failed to record incoming transaction:', e.message));

        } catch (error) {
            // This part is tricky. The money has moved. We should have a compensating action or a retry mechanism.
            // For this POC, we'll just log the error.
            console.error('Critical error: Failed to record transactions after balance update.', error);
        }

        res.status(200).json({ message: 'Transfer completed successfully!' });

    } catch (error) {
        console.error('Transfer failed:', error.message);
        res.status(500).json({ message: 'An unexpected error occurred during the transfer.' });
    }
});

app.listen(port, () => {
    console.log(`Transfer service listening at http://localhost:${port}`);
});