// Helper function to format current date to Nepal Time (YYYY-MM-DD HH:mm:ss)
const getNepalDateTime = () => {
  const now = new Date();
  // Offset for UTC+5:45 in milliseconds
  const nepalOffset = (5 * 60 + 45) * 60 * 1000;
  const nepalTime = new Date(now.getTime() + nepalOffset);
  return nepalTime.toISOString().slice(0, 19).replace("T", " ");
};

module.exports = {
  getNepalDateTime,
};
