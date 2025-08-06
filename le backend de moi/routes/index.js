const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./authRoutes");
const clientRoutes = require("./clientRoutes");
const WorkerRoutes = require("./workerRoutes");
const teamRoutes = require("./teamRoutes");
const taskRoutes = require("./taskRoutes");
const adminRoutes = require("./adminRoutes");
const payRoutes = require("./paymentRoutes");
const notifications = require("./notificationRoutes");
const messageRoutes = require("./messageRoutes");
const contractRoutes = require("./contractRoutes");
const reviewRoutes = require("./reviewRoutes");

// Route middleware
router.use("/auth", authRoutes);
router.use("/client", clientRoutes);
router.use("/worker", WorkerRoutes);
router.use("/team", teamRoutes);
router.use("/task", taskRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notifications);
router.use("/pay", payRoutes);
router.use("/message", messageRoutes);
router.use("/contract", contractRoutes);
router.use("/review", reviewRoutes);
router.use("/ping", (req, res) => {
    res.send("✅ Server is healthy.");
  });

module.exports = router;