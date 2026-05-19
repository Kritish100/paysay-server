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

// Optional: Initial connection health check logged to stderr if database is down entirely
db.getConnection((err, connection) => {
    if (err) {
        console.error(`[CRITICAL] [DATABASE] Connection pool initialization failed: ${err.message}`);
    } else {
        connection.release();
    }
});

// SECURITY KEY MIDDLEWARE
// Checks for the secret app key to ensure our API is not publicly accessible
const verifyAppKey = (req, res, next) => {
    // Look for the key in headers
    const clientKey = req.headers['x-api-key'];
    const serverKey = process.env.API_SECRET_KEY || 'PaySay_AppKey_2026_KritiCrafts'; // Default key for testing

    if (!clientKey || clientKey !== serverKey) {
        console.error(`[WARN] [${req.method}] ${req.originalUrl} - Unauthorized access attempt. Bad or missing API Key.`);
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Unauthorized client application access.' 
        });
    }

    // Key is valid! Pass control to the actual API route logic
    next();
};


// REGISTER USER
app.post('/api/register/:ssaid', verifyAppKey, (req, res) => {
    const { ssaid } = req.params;
    const username = "Guest"

    if (!ssaid) {
        return res.status(400).json({ success: false, error: 'SSAID is required' });
    }

    // 1. Check if the device is already in the system
    const checkSql = "SELECT user_created_at, status FROM users WHERE ssaid = ?";

    db.query(checkSql, [ssaid], (err, results) => {
        if (err) {
            console.error(`[ERROR] [POST] /api/register - Device check lookup failed for SSAID: ${ssaid}. Details: ${err.message}`);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (results.length > 0) {
            // Returning User Logic
            const existingUser = results[0];
            const user = results[0];
            return res.json({
                success: true,
                isRegistered: true,
                username: existingUser.username,
                user_created_at: existingUser.user_created_at,
                status: existingUser.status
            });
        } else {
            // 2. New User Logic: Register them and start the clock
            const insertSql = "INSERT INTO users (username, ssaid) VALUES (?, ?)";
            db.query(insertSql, [username || 'Guest', ssaid], (err) => {
                if (err) {
                    console.error(`[ERROR] [POST] /api/register - Failed to insert new user record for SSAID: ${ssaid}. Details: ${err.message}`);
                    return res.status(500).json({ success: false, error: 'Failed to register device' });
                }
                
                res.status(201).json({ 
                    success: true,
                    isRegistered: true,
                    username: username || 'Guest',
                    user_created_at: new Date().toISOString().split('T')[0], // Approximation
                    status: 'trial'
                });
            });
        }
    });
});


// GET USER PROFILE & UPDATE LAST CHECK IN
app.get('/api/ping/:ssaid', verifyAppKey, (req, res) => {
    const { ssaid } = req.params;

    if (!ssaid) {
        return res.status(400).json({ error: 'SSAID parameter is required' });
    }

    // Query the database for the specific device
    const selectSql = "SELECT username, ssaid, user_created_at, status FROM users WHERE ssaid = ?";
    // Force an update to last_check_in by setting it to the current time manually
    const updateSql = "UPDATE users SET last_check_in = CURRENT_TIMESTAMP WHERE ssaid = ?";

    db.query(selectSql, [ssaid], (err, results) => {
        if (err) {
            console.error(`[ERROR] [GET] /api/ping/${ssaid} - Profile selection failed. Details: ${err.message}`);
            return res.status(500).json({ success: false, error: 'Database error', details: err.message });
        }

        // If no user matches the given SSAID
        if (results.length === 0) {
            return res.status(200).json({ 
                success: true,
                isRegistered: false,
                username: null,
                user_created_at: null,
                status: null,
            });
        }

        // Extract values from the first database row matrix
        const userData = results[0];
        
        // Send the exact user data found in the database
        res.json({ 
            success: true,
            isRegistered: true,
            username: userData.username,
            user_created_at: userData.user_created_at,
            status: userData.status,
        });

        // Update Last Check In
        db.query(updateSql, [ssaid], (updateErr) => {
            console.error(`[BACKGROUND WARNING] [GET] /api/ping/${ssaid} - Failed to update last_check_in timestamp. Details: ${updateErr.message}`);
        });
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

