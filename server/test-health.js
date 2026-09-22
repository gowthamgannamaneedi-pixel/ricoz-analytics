const http = require('http');
const app = require('./app');

// Start server on temporary port for verification
const server = app.listen(5099, async () => {
  console.log('Testing server running on port 5099');

  try {
    const response = await new Promise((resolve, reject) => {
      http.get('http://localhost:5099/api/health', (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(rawData)
          });
        });
      }).on('error', reject);
    });

    console.log('--- TEST RESULTS ---');
    console.log('Status Code:', response.statusCode);
    console.log('Response Body:', JSON.stringify(response.body, null, 2));

    const expected = {
      success: true,
      message: 'RicozAnalytics API is running'
    };

    if (
      response.statusCode === 200 &&
      response.body.success === true &&
      response.body.message === 'RicozAnalytics API is running'
    ) {
      console.log(' Health Check Test: PASSED');
      server.close(() => {
        process.exit(0);
      });
    } else {
      console.error(' Health Check Test: FAILED (mismatched output)');
      server.close(() => {
        process.exit(1);
      });
    }
  } catch (err) {
    console.error(' Health Check Test Error:', err);
    server.close(() => {
      process.exit(1);
    });
  }
});
