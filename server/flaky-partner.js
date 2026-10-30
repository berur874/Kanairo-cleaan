const express = require('express');
const app = express();
let mode = 'ok'; // ok | slow | flaky | error
let calls = 0;

// Switch behavior: curl http://localhost:4000/__mode/slow
app.get('/__mode/:m', (req, res) => {
  mode = req.params.m;
  calls = 0;
  console.log(`Switched mode to: ${mode}`);
  res.json({ mode });
});

// Catch-all handler for all partner API calls made by app.js
app.use(async (req, res) => {
  calls += 1;
  console.log(`${req.method} ${req.path} (call ${calls}, mode ${mode})`);

  if (mode === 'slow') { // 10-second delay
    await new Promise((r) => setTimeout(r, 10000));
  }
  if (mode === 'flaky' && calls % 3 !== 0) { // Fails 2 out of 3 times
    return res.status(503).json({ message: 'Try again' });
  }
  if (mode === 'error') { // Always fails
    return res.status(500).json({ message: 'Internal error' });
  }

  // Sample venue response matching Group 12 schema
  res.json([
    {
      id: 1,
      slug: 'dandora-market',
      name: 'Dandora Market',
      area: 'Dandora',
      address: 'Phase 2',
      category: 'market',
      accessibility: { ramp: true, accessibleToilet: false, accessibleParking: true }
    }
  ]);
});

app.listen(4000, () => console.log('Stand-in partner running on http://localhost:4000'));