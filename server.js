const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to redirect back to index.html for general static routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur local PrestaFlow démarré sur http://localhost:${PORT}`);
  console.log(`- Interface Agent : http://localhost:${PORT}`);
  console.log(`- Interface Admin : http://localhost:${PORT}/admin`);
});
