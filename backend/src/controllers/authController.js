// CampusDine Controller: Auth & User Profile Management
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const AuthController = {
  // Login handler with role authentication
  async login(req, res) {
    try {
      const { externalId, password } = req.body;
      if (!externalId || !password) {
        return res.status(400).json({ error: "Student/Employee ID and password are required" });
      }

      const [users] = await pool.query(
        "SELECT id, name, email, external_id, password_hash, role, account_type, hall_name, room_number, hall_id, wallet_balance, avatar_url FROM users WHERE external_id = ?",
        [externalId]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = users[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, externalId: user.external_id, role: user.role, accountType: user.account_type },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          externalId: user.external_id,
          role: user.role,
          accountType: user.account_type,
          hallName: user.hall_name,
          roomNumber: user.room_number,
          hallId: user.hall_id,
          walletBalance: Number(user.wallet_balance || 0),
          avatar: user.avatar_url
        }
      });
    } catch (error) {
      console.error("AuthController.login error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Get current user profile
  async getProfile(req, res) {
    try {
      const [users] = await pool.query(
        "SELECT id, name, email, external_id, role, account_type, hall_name, room_number, hall_id, wallet_balance, avatar_url FROM users WHERE id = ?",
        [req.user.id]
      );
      if (users.length === 0) return res.status(404).json({ error: "User not found" });

      const u = users[0];
      return res.json({
        id: u.id,
        name: u.name,
        email: u.email,
        externalId: u.external_id,
        role: u.role,
        accountType: u.account_type,
        hallName: u.hall_name,
        roomNumber: u.room_number,
        hallId: u.hall_id,
        walletBalance: Number(u.wallet_balance || 0),
        avatar: u.avatar_url
      });
    } catch (error) {
      console.error("AuthController.getProfile error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Update profile details
  async updateProfile(req, res) {
    try {
      const { name, email, avatarUrl, hallName, roomNumber } = req.body;
      await pool.query(
        "UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), hall_name = COALESCE(?, hall_name), room_number = COALESCE(?, room_number) WHERE id = ?",
        [name, email, avatarUrl, hallName, roomNumber, req.user.id]
      );
      return res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error("AuthController.updateProfile error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
};

module.exports = AuthController;
