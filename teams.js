const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const db = require("./db");
const { getNepalDateTime } = require("./utils");
const { verifyAppKey } = require("./middleware");
const messaging = require("./firebase");

// 1. CREATE A TEAM
router.post("/create", verifyAppKey, (req, res) => {
  const { ssaid } = req.body;
  if (!ssaid) {
    return res.status(400).json({ success: false, error: "SSAID is required" });
  }

  db.query(
    "SELECT status FROM users WHERE ssaid = ?",
    [ssaid],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      if (results.length === 0 || results[0].status !== "premium") {
        return res.status(403).json({
          success: false,
          error: "Premium subscription required to create teams.",
        });
      }

      const teamCode = crypto.randomBytes(3).toString("hex").toUpperCase();
      const currentTime = getNepalDateTime();

      db.getConnection((connErr, connection) => {
        if (connErr) {
          return res
            .status(500)
            .json({ success: false, error: "Database connection failed" });
        }

        connection.beginTransaction((txErr) => {
          if (txErr) {
            connection.release();
            return res
              .status(500)
              .json({ success: false, error: "Transaction failed" });
          }

          connection.query(
            "INSERT INTO teams (team_code, owner_ssaid, created_at) VALUES (?, ?, ?)",
            [teamCode, ssaid, currentTime],
            (insertErr) => {
              if (insertErr) {
                connection.rollback();
                connection.release();
                return res
                  .status(500)
                  .json({ success: false, error: "Failed to create team" });
              }

              connection.query(
                "UPDATE users SET team_code = ? WHERE ssaid = ?",
                [teamCode, ssaid],
                (updateErr) => {
                  if (updateErr) {
                    connection.rollback();
                    connection.release();
                    return res
                      .status(500)
                      .json({ success: false, error: "Failed to join team" });
                  }

                  connection.commit((commitErr) => {
                    if (commitErr) {
                      connection.rollback();
                      connection.release();
                      return res
                        .status(500)
                        .json({ success: false, error: "Commit failed" });
                    }
                    connection.release();
                    res
                      .status(201)
                      .json({ success: true, team_code: teamCode });
                  });
                },
              );
            },
          );
        });
      });
    },
  );
});

// 2. VIEW MY TEAM
router.get("/:ssaid", verifyAppKey, (req, res) => {
  const { ssaid } = req.params;

  db.query(
    "SELECT team_code FROM users WHERE ssaid = ?",
    [ssaid],
    (err, results) => {
      if (err || results.length === 0 || !results[0].team_code) {
        return res.json({ success: true, hasTeam: false });
      }

      const teamCode = results[0].team_code;
      const ownerQuery = "SELECT owner_ssaid FROM teams WHERE team_code = ?";
      const membersQuery =
        "SELECT ssaid, username, status FROM users WHERE team_code = ?";

      db.query(ownerQuery, [teamCode], (ownerErr, ownerResults) => {
        if (ownerErr || ownerResults.length === 0) {
          return res
            .status(500)
            .json({ success: false, error: "Team not found" });
        }
        const ownerSsaid = ownerResults[0].owner_ssaid;

        db.query(membersQuery, [teamCode], (memErr, memberResults) => {
          if (memErr) {
            return res
              .status(500)
              .json({ success: false, error: "Failed to fetch members" });
          }

          const mappedMembers = memberResults.map((m) => ({
            ssaid: m.ssaid,
            name: m.username,
            role: m.ssaid === ownerSsaid ? "Manager" : "Member",
            status: m.status,
          }));

          res.json({
            success: true,
            hasTeam: true,
            team_code: teamCode,
            members: mappedMembers,
          });
        });
      });
    },
  );
});

// 3. JOIN A TEAM
router.post("/join", verifyAppKey, (req, res) => {
  const { ssaid, team_code } = req.body;
  if (!ssaid || !team_code) {
    return res
      .status(400)
      .json({ success: false, error: "Missing parameters" });
  }

  db.query(
    "SELECT COUNT(*) as count FROM users WHERE team_code = ?",
    [team_code],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      if (results[0].count >= 4) {
        return res.status(403).json({
          success: false,
          error: "Team has reached the maximum limit of 4 devices.",
        });
      }

      db.query(
        "UPDATE users SET team_code = ? WHERE ssaid = ?",
        [team_code, ssaid],
        (updateErr) => {
          if (updateErr) {
            return res
              .status(500)
              .json({ success: false, error: "Failed to join team" });
          }
          res.json({ success: true, message: "Joined successfully" });
        },
      );
    },
  );
});

// 4. TERMINATE TEAM (Manager Only)
router.delete("/terminate/:ssaid", verifyAppKey, (req, res) => {
  const { ssaid } = req.params;
  db.query(
    "DELETE FROM teams WHERE owner_ssaid = ?",
    [ssaid],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      if (results.affectedRows === 0) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized or team not found.",
        });
      }
      res.json({ success: true, message: "Team terminated successfully" });
    },
  );
});

// 5. REMOVE A MEMBER (Manager Only)
router.post("/remove", verifyAppKey, (req, res) => {
  const { manager_ssaid, target_ssaid } = req.body;

  db.query(
    "SELECT owner_ssaid FROM teams WHERE owner_ssaid = ?",
    [manager_ssaid],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(403).json({ success: false, error: "Unauthorized." });
      }

      db.query(
        "UPDATE users SET team_code = NULL WHERE ssaid = ?",
        [target_ssaid],
        (updateErr) => {
          if (updateErr) {
            return res
              .status(500)
              .json({ success: false, error: "Failed to remove member" });
          }
          res.json({ success: true, message: "Member removed" });
        },
      );
    },
  );
});

// 6. LEAVE A TEAM (Member Only)
router.post("/leave", verifyAppKey, (req, res) => {
  const { ssaid } = req.body;
  db.query(
    "UPDATE users SET team_code = NULL WHERE ssaid = ?",
    [ssaid],
    (err) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, error: "Failed to leave team" });
      }
      res.json({ success: true, message: "Left team successfully" });
    },
  );
});

// 7. UPDATE FCM TOKEN
router.post("/update-token", verifyAppKey, (req, res) => {
  const { ssaid, fcm_token } = req.body;
  if (!ssaid || !fcm_token) {
    return res
      .status(400)
      .json({ success: false, error: "Missing parameters" });
  }

  db.query(
    "UPDATE users SET fcm_token = ? WHERE ssaid = ?",
    [fcm_token, ssaid],
    (err) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      res.json({ success: true, message: "FCM Token updated successfully" });
    },
  );
});

// 8. BROADCAST PAYMENT TO TEAM
router.post("/broadcast", verifyAppKey, (req, res) => {
  const { sender_ssaid, title, speechText, amount } = req.body;

  if (!sender_ssaid || !speechText) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  // Find the team code for this sender
  db.query(
    "SELECT team_code FROM users WHERE ssaid = ?",
    [sender_ssaid],
    (err, userResults) => {
      if (err || userResults.length === 0 || !userResults[0].team_code) {
        return res
          .status(400)
          .json({ success: false, error: "User is not in an active team" });
      }

      const teamCode = userResults[0].team_code;

      // Fetch FCM tokens of all OTHER members in the same team
      const tokensQuery =
        "SELECT fcm_token FROM users WHERE team_code = ? AND ssaid != ? AND fcm_token IS NOT NULL";

      db.query(
        tokensQuery,
        [teamCode, sender_ssaid],
        async (tokenErr, memberResults) => {
          if (tokenErr)
            return res
              .status(500)
              .json({ success: false, error: "Database error" });

          const tokens = memberResults.map((r) => r.fcm_token).filter((t) => t);

          if (tokens.length === 0) {
            return res.json({
              success: true,
              message: "No active team members to notify",
            });
          }

          // Construct the High-Priority FCM payload
          const payload = {
            tokens: tokens, // Array of tokens to send to
            data: {
              type: "PAYMENT_ALERT",
              title: title || "Payment Received",
              speechText: speechText, // The exact formatted string PaySay will read out loud
              amount: amount ? String(amount) : "",
              timestamp: String(Date.now()),
            },
            android: {
              priority: "high", // Guaranteed to instantly wake up Doze-mode devices
            },
          };

          try {
            const response = await messaging.sendEachForMulticast(payload);
            res.json({ success: true, deliveredCount: response.successCount });
          } catch (fcmError) {
            console.error(`[FCM ERROR] Broadcast failed: ${fcmError.message}`);
            res
              .status(500)
              .json({ success: false, error: "FCM broadcast failed" });
          }
        },
      );
    },
  );
});

module.exports = router;
