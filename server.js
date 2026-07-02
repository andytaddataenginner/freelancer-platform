require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors({ origin:'*', methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'], credentials:false }));
app.options('*', cors());
app.use(express.json());

app.use('/api/auth',           require('./routes/auth'));
app.use('/api/clients',        require('./routes/clients'));
app.use('/api/timelogs',       require('./routes/timelogs'));
app.use('/api/schedule',       require('./routes/schedule'));
app.use('/api/portfolio',      require('./routes/portfolio'));
app.use('/api/stats',          require('./routes/stats'));
app.use('/api/contact',        require('./routes/contact'));
app.use('/api/client',         require('./routes/client-portal'));
app.use('/api/payments',       require('./routes/payments'));
app.use('/api/fixed-payments', require('./routes/fixed-payments')); // ← NEW

app.get('/api/health', (req, res) => res.json({ status:'ok', timestamp:new Date() }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status||500).json({ error:err.message||'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✓ API running on port ${PORT}`));
