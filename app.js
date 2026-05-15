require('dotenv').config();
const express = require('express'); 
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

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
});

app.listen(PORT, () => {});
