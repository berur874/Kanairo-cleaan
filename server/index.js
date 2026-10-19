const { app, ensureScrapLogsSchema } = require('./app');

const port = process.env.PORT || 5000;

if (!process.env.API_TOKEN) {
  console.error('API_TOKEN is not set. Add it to server/.env before starting the API.');
  process.exit(1);
}

ensureScrapLogsSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize scrap_logs schema:', err.message);
    process.exit(1);
  });
