const express = require("express");
const router = express.Router();

router.use((req, res, next) => {
  console.log(`👉 Request received: ${req.method} ${req.url}`);
  next();
});

const authController = require("../controllers/authController");

router.post("/login", authController.login_user);
router.post("/register", authController.register_user);
router.post("/getUserRole", authController.getUserRole);
router.post('/logout', authController.logoutUser);

module.exports = router;
