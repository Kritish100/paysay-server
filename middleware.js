const verifyAppKey = (req, res, next) => {
  const clientKey = req.headers["x-api-key"];
  const serverKey = process.env.API_SECRET_KEY || "PaySay_API_KEY";

  if (!clientKey || clientKey !== serverKey) {
    console.error(
      `[WARN] [${req.method}] ${req.originalUrl} - Unauthorized access attempt.`,
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "Unauthorized client application access.",
    });
  }
  next();
};

module.exports = {
  verifyAppKey,
};
