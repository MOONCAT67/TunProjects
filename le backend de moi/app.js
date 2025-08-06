const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const logger = require("morgan");
const bodyParser = require("body-parser");
const paymentRoutes = require('./routes/paymentRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');

// Load environment variables
dotenv.config();

// Connect to DB
require("./config/db");

// Init Express app
const app = express();

// Middlewares
app.use(cors());
app.use(logger("dev"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Use routes from routes/index.js
const indexRouter = require("./routes/index");
app.use("/", indexRouter);

// Use new routes
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);

// Health Check Route
app.get("/", (req, res) => {
  res.send("✅ Server is running and connected to DB.");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});