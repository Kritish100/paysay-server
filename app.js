require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const crypto = require("crypto");
const app = express();

// 1. Import your modularized dependencies
const db = require("./db");
const { getNepalDateTime } = require("./utils");
const { verifyAppKey } = require("./middleware");
const teamRoutes = require("./teams");

app.use(express.json());
const PORT = process.env.PORT || 3000;

// 2. Mount the Teams Router
// Every request starting with /api/team will now be handled by teams.js
app.use("/api/team", teamRoutes);

// REGISTER USER
app.post("/api/register/:ssaid", verifyAppKey, (req, res) => {
  const { ssaid } = req.params;
  const { username } = req.body;
  if (!ssaid) {
    return res.status(400).json({ success: false, error: "SSAID is required" });
  }

  const checkSql =
    "SELECT username, user_created_at, status FROM users WHERE ssaid = ?";
  db.query(checkSql, [ssaid], (err, results) => {
    if (err) {
      console.error(
        `[ERROR] [POST] /api/register - Lookup failed: ${err.message}`,
      );
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (results.length > 0) {
      const existingUser = results[0];
      return res.json({
        success: true,
        isRegistered: true,
        username: existingUser.username,
        user_created_at: existingUser.user_created_at,
        status: existingUser.status,
      });
    } else {
      const uniqueId = crypto.randomBytes(2).toString("hex").toUpperCase();
      const baseName = username ? username.trim() : "Guest";
      const finalUsername = `${baseName}_${uniqueId}`;
      const insertSql =
        "INSERT INTO users (username, ssaid, user_created_at) VALUES (?, ?, ?)";
      const currentTime = getNepalDateTime();

      db.query(insertSql, [finalUsername, ssaid, currentTime], (insertErr) => {
        if (insertErr) {
          console.error(
            `[ERROR] [POST] /api/register - Insert failed: ${insertErr.message}`,
          );
          return res
            .status(500)
            .json({ success: false, error: "Failed to register device" });
        }

        db.query(checkSql, [ssaid], (fetchErr, newResults) => {
          if (fetchErr || newResults.length === 0) {
            return res.status(201).json({
              success: true,
              isRegistered: true,
              username: finalUsername,
              status: "trial",
            });
          }
          const newUser = newResults[0];
          res.status(201).json({
            success: true,
            isRegistered: true,
            username: newUser.username,
            user_created_at: newUser.user_created_at,
            status: newUser.status || "trial",
          });
        });
      });
    }
  });
});

// GET USER PROFILE & UPDATE LAST CHECK IN
app.get("/api/ping/:ssaid", verifyAppKey, (req, res) => {
  const { ssaid } = req.params;
  if (!ssaid) {
    return res.status(400).json({ error: "SSAID parameter is required" });
  }

  const selectSql =
    "SELECT username, ssaid, user_created_at, status FROM users WHERE ssaid = ?";
  const updateSql =
    "UPDATE users SET last_check_in = ?, ping_count = ping_count + 1 WHERE ssaid = ?";
  const dailyPingSql = `
    INSERT INTO daily_pings (ssaid, username, ping_date, ping_count) 
    VALUES (?, ?, ?, 1) 
    ON DUPLICATE KEY UPDATE ping_count = ping_count + 1, username = VALUES(username);
  `;

  db.query(selectSql, [ssaid], (err, results) => {
    if (err) {
      console.error(
        `[ERROR] [GET] /api/ping/${ssaid} - Profile select failed: ${err.message}`,
      );
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        isRegistered: false,
        username: null,
        user_created_at: null,
        status: null,
      });
    }

    const userData = results[0];
    res.json({
      success: true,
      isRegistered: true,
      username: userData.username,
      user_created_at: userData.user_created_at,
      status: userData.status,
    });

    const currentTime = getNepalDateTime();
    db.query(updateSql, [currentTime, ssaid], (updateErr) => {
      if (updateErr) {
        console.error(
          `[BACKGROUND WARNING] [GET] /api/ping/${ssaid} - Failed to update check-in: ${updateErr.message}`,
        );
      }
    });

    const pingDateOnly = currentTime.split(" ")[0];
    db.query(
      dailyPingSql,
      [ssaid, userData.username, pingDateOnly],
      (dailyErr) => {
        if (dailyErr) {
          console.error(
            `[ERROR] Failed to record daily ping: ${dailyErr.message}`,
          );
        }
      },
    );
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// ROOT ROUTE
app.get("/", (req, res) => {
  // FIXED: Removed duplicate res.send()
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
