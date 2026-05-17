require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express'); 
const mysql = require('mysql2');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Database Connection Pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});


// REGISTER USER
app.post('/api/register', (req, res) => {
    const { username, ssaid } = req.body;

    if (!ssaid) {
        return res.status(400).json({ error: 'SSAID is required' });
    }

    // 1. Check if the device is already in the system
    const checkSql = "SELECT user_created_at, status FROM users WHERE ssaid = ?";

    db.query(checkSql, [ssaid], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length > 0) {
            // Returning User Logic
            const user = results[0];
            const userCreatedTime = new Date(user.user_created_at).getTime();
            const now = new Date().getTime();
            const twoDaysInMillis = 2 * 24 * 60 * 60 * 1000;

            if (user.status === 'premium') {
                return res.json({ status: 'premium', message: 'Premium Member' });
            } else if (user.status === 'trial') {
                return res.json({ 
                    status: 'trial', 
                    message: 'Trial is active',
                    remaining: twoDaysInMillis - (now - userCreatedTime) 
                });
            } else {
                return res.json({ status: 'expired', message: 'Trial has ended' });
            }
        } else {
            // 2. New User Logic: Register them and start the clock
            const insertSql = "INSERT INTO users (username, ssaid) VALUES (?, ?)";
            db.query(insertSql, [username || 'Guest', ssaid], (err) => {
                if (err) return res.status(500).json({ error: 'Failed to register device' });
                
                res.status(201).json({ 
                    status: 'trial', 
                    message: 'Welcome! Your 2-day trial has started.' 
                });
            });
        }
    });
});


// UPDATE LAST CHECKED IN TIME
app.put('/api/ping/:ssaid', (req, res) => {
    const { ssaid } = req.params;

    if (!ssaid) {
        return res.status(400).json({ error: 'SSAID parameter is required' });
    }

    // Force an update to last_check_in by setting it to the current time manually
    const sql = "UPDATE users SET last_check_in = CURRENT_TIMESTAMP WHERE ssaid = ?";

    db.query(sql, [ssaid], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        // Check if the user actually exists in the database
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send back a clean acknowledgment
        res.json({ 
            success: true, 
            message: 'Last check-in updated successfully' 
        });
    });
});


// GET USER
app.get('/api/user/:ssaid', (req, res) => {
    const { ssaid } = req.params;

    if (!ssaid) {
        return res.status(400).json({ error: 'SSAID parameter is required' });
    }

    // Query the database for the specific device
    const sql = "SELECT username, ssaid, user_created_at, status FROM users WHERE ssaid = ?";

    db.query(sql, [ssaid], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        // If no user matches the given SSAID
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return the exact user data found in the database
        res.json(results[0]);
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PaySay API | KritiCrafts</title>
            <style>
                body { font-family: sans-serif; background: #004d4d; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #003333; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); text-align: center; border: 1px solid #ffbf00; }
                h1 { color: #ffbf00; margin-bottom: 0.5rem; }
                p { opacity: 0.8; }
                .status-dot { height: 10px; width: 10px; background-color: #00ff00; border-radius: 50%; display: inline-block; margin-right: 5px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>PaySay API</h1>
                <p><span class="status-dot"></span> Server is Live & Secure</p>
                <p style="font-size: 0.8rem;">&copy; 2026 KritiCrafts</p>
            </div>
        </body>
        </html>
    `);
    res.send(``)
});

app.listen(PORT, () => {});

