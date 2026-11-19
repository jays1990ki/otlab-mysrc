// Plesk / Passenger startup entry point.
import('./app.js').catch(error => {
  console.error('Application startup failed:', error.message);
  process.exitCode = 1;
});
