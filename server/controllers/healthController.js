// Controller for API health status verification
const getHealthStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'RicozAnalytics API is running'
  });
};

module.exports = {
  getHealthStatus
};
