import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

// API clients for our services
const userApi = axios.create({ baseURL: '/api/users' });
const walletApi = axios.create({ baseURL: '/api/wallet' });
const transactionsApi = axios.create({ baseURL: '/api/transactions' });
const transferApi = axios.create({ baseURL: '/api/transfer' });

function App() {
    const [user, setUser] = useState(null); // Logged-in user object
    const [view, setView] = useState('register'); // 'register', 'login', or 'dashboard'
    
    const handleLogout = () => {
        setUser(null);
        setView('login');
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Digital Payment Wallet</h1>
                {user && <button onClick={handleLogout} className="logout-button">Logout</button>}
            </header>
            <main className="App-main">
                {!user ? (
                    <AuthView setView={setView} view={view} onLoginSuccess={setUser} />
                ) : (
                    <Dashboard user={user} />
                )}
            </main>
        </div>
    );
}

// ==================================
// AUTHENTICATION COMPONENTS
// ==================================
const AuthView = ({ view, setView, onLoginSuccess }) => {
    const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await userApi.post('/register', formData);
            setMessage(res.data.message + ' Please login.');
            setView('login');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed.');
        }
    };
    
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            // Use the new, proper /login endpoint
            const res = await userApi.post('/login', {
                email: formData.email,
                password: formData.password
            });
            onLoginSuccess(res.data.user); // Set the user object on successful login
        } catch (err) {
             setError(err.response?.data?.message || 'Login failed.');
        }
    };

    return (
        <div className="auth-container">
            {view === 'register' ? (
                <form onSubmit={handleRegister} className="auth-form">
                    <h2>Register</h2>
                    <input name="fullName" type="text" placeholder="Full Name" onChange={handleChange} required />
                    <input name="email" type="email" placeholder="Email" onChange={handleChange} required />
                    <input name="password" type="password" placeholder="Password" onChange={handleChange} required />
                    <button type="submit">Register</button>
                    <p>Already have an account? <span onClick={() => setView('login')}>Login</span></p>
                </form>
            ) : (
                <form onSubmit={handleLogin} className="auth-form">
                    <h2>Login</h2>
                    <input name="email" type="email" placeholder="Email" onChange={handleChange} required />
                    <input name="password" type="password" placeholder="Password" onChange={handleChange} required />
                    <button type="submit">Login</button>
                    <p>Don't have an account? <span onClick={() => setView('register')}>Register</span></p>
                </form>
            )}
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}
        </div>
    );
};


// ==================================
// DASHBOARD COMPONENTS
// ==================================
const Dashboard = ({ user }) => {
    return (
        <div className="dashboard">
            <h2>Welcome, {user.fullName}!</h2>
            <div className="dashboard-main">
                <div className="dashboard-left">
                    <Wallet user={user} />
                    <Transfer user={user} />
                </div>
                <div className="dashboard-right">
                    <TransactionHistory userId={user.id} />
                </div>
            </div>
        </div>
    );
};

const Wallet = ({ user }) => {
    const [balance, setBalance] = useState(0);
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');

    const fetchBalance = useCallback(async () => {
        try {
            const res = await walletApi.get(`/balance/${user.id}`);
            setBalance(res.data.balance);
        } catch (err) {
            console.error('Failed to fetch balance:', err);
            setError('Could not fetch balance.');
        }
    }, [user.id]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    const handleAction = async (action) => {
        setError('');
        try {
            await walletApi.post(`/${action}`, { userId: user.id, amount });
            setAmount('');
            fetchBalance(); // Refresh balance
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${action}.`);
        }
    };

    return (
        <div className="wallet-container component-card">
            <h3>Your Wallet</h3>
            <p className="balance">Balance: ${parseFloat(balance).toFixed(2)}</p>
            {error && <p className="error-message">{error}</p>}
            <div className="wallet-actions">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
                <button onClick={() => handleAction('deposit')}>Deposit</button>
                <button onClick={() => handleAction('withdraw')}>Withdraw</button>
            </div>
        </div>
    );
};

const Transfer = ({ user }) => {
    const [toUserEmail, setToUserEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleTransfer = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await transferApi.post('/transfer', { fromUserId: user.id, toUserEmail, amount });
            setMessage(res.data.message);
            setAmount('');
            setToUserEmail('');
            // Note: In a real app, you'd use websockets or polling to update balance in real-time
        } catch (err) {
            setError(err.response?.data?.message || 'Transfer failed.');
        }
    };
    
    return (
        <div className="transfer-container component-card">
            <h3>Transfer Funds</h3>
            <form onSubmit={handleTransfer}>
                <input type="email" value={toUserEmail} onChange={(e) => setToUserEmail(e.target.value)} placeholder="Recipient's Email" required />
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
                <button type="submit">Send</button>
            </form>
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}
        </div>
    );
};

const TransactionHistory = ({ userId }) => {
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await transactionsApi.get(`/history/${userId}`);
                setHistory(res.data);
            } catch (err) {
                setError('Failed to fetch transaction history.');
            }
        };
        fetchHistory();
        // Poll for new transactions every 10 seconds
        const interval = setInterval(fetchHistory, 10000);
        return () => clearInterval(interval);
    }, [userId]);

    return (
        <div className="history-container component-card">
            <h3>Transaction History</h3>
            {error && <p className="error-message">{error}</p>}
            <ul>
                {history.length > 0 ? history.map(tx => (
                    <li key={tx.id} className={`tx-item tx-${tx.type}`}>
                        <span className="tx-type">{tx.type.replace('_', ' ')}</span>
                        <span className="tx-amount">${parseFloat(tx.amount).toFixed(2)}</span>
                        <span className="tx-info">
                            {tx.type.includes('transfer') ? `To/From: ${tx.relatedUserFullName || 'N/A'}` : ''}
                        </span>
                        <span className="tx-time">{new Date(tx.timestamp).toLocaleString()}</span>
                    </li>
                )) : <p>No transactions yet.</p>}
            </ul>
        </div>
    );
};

export default App;
