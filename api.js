
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const User = require("./database/User");
const Chat = require("./database/Chat");

const app = express();

// ================================
// CONFIGURATION
// ================================

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.OPENAI_API_KEYS;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const JWT_SECRET = process.env.JWT_SECRET;

if (!API_KEY) {
  console.error("ERROR: Chưa cấu hình OPENAI_API_KEYS.");
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error("ERROR: Chưa cấu hình JWT_SECRET.");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error("ERROR: Chưa cấu hình MONGODB_URI.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: API_KEY
});

// ================================
// MIDDLEWARE
// ================================

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau."
  }
}));

// ================================
// AUTH MIDDLEWARE
// ================================

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Vui lòng đăng nhập."
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Phiên đăng nhập không hợp lệ."
    });
  }
}

// ================================
// REGISTER
// ================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Vui lòng nhập đầy đủ thông tin."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Mật khẩu phải có ít nhất 8 ký tự."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      email: normalizedEmail
    });

    if (existing) {
      return res.status(409).json({
        error: "Email đã được sử dụng."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    res.status(201).json({
      message: "Đăng ký thành công.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Register error:", error.message);

    res.status(500).json({
      error: "Không thể đăng ký tài khoản."
    });
  }
});

// ================================
// LOGIN
// ================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Thiếu email hoặc mật khẩu."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        error: "Email hoặc mật khẩu không chính xác."
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Đăng nhập thành công.",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      error: "Không thể đăng nhập."
    });
  }
});

// ================================
// CURRENT USER
// ================================

app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        error: "Không tìm thấy tài khoản."
      });
    }

    res.json({ user });

  } catch (error) {
    console.error("Get user error:", error.message);

    res.status(500).json({
      error: "Không thể lấy thông tin tài khoản."
    });
  }
});

// ================================
// CHAT WITH GPT
// ================================

app.post("/api/chat", authenticate, async (req, res) => {
  try {
    const { message, chatId, language = "vi" } = req.body;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Tin nhắn không được để trống."
      });
    }

    if (message.length > 12000) {
      return res.status(413).json({
        error: "Tin nhắn quá dài."
      });
    }

    let chat;

    // Tìm cuộc trò chuyện cũ
    if (chatId) {
      chat = await Chat.findOne({
        _id: chatId,
        userId: req.user.userId
      });

      if (!chat) {
        return res.status(404).json({
          error: "Không tìm thấy cuộc trò chuyện."
        });
      }
    } else {
      // Tạo cuộc trò chuyện mới
      chat = await Chat.create({
        userId: req.user.userId,
        title: message.trim().slice(0, 60),
        messages: []
      });
    }

    // Lấy 20 tin nhắn gần nhất
    const history = chat.messages.slice(-20).map(item => ({
      role: item.role,
      content: item.content
    }));

    // Gửi yêu cầu đến OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",
          content:
            `Bạn là NguyezCodex, một trợ lý AI hữu ích. ` +
            `Hãy trả lời bằng ngôn ngữ: ${language}.`
        },
        ...history,
        {
          role: "user",
          content: message.trim()
        }
      ]
    });

    const answer = response.choices[0]?.message?.content;

    if (!answer) {
      throw new Error("OpenAI returned an empty response.");
    }

    // Lưu tin nhắn vào MongoDB
    chat.messages.push(
      {
        role: "user",
        content: message.trim()
      },
      {
        role: "assistant",
        content: answer
      }
    );

    chat.updatedAt = new Date();

    await chat.save();

    res.json({
      success: true,
      chatId: chat._id,
      reply: answer,
      model: MODEL
    });

  } catch (error) {
    console.error("Chat error:", error.message);

    res.status(500).json({
      error: "Không thể gửi tin nhắn đến GPT."
    });
  }
});

// ================================
// CHAT HISTORY
// ================================

app.get("/api/chats", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({
      userId: req.user.userId
    })
      .select("title updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100);

    res.json({ chats });

  } catch (error) {
    console.error("History error:", error.message);

    res.status(500).json({
      error: "Không thể tải lịch sử."
    });
  }
});

// ================================
// GET ONE CHAT
// ================================

app.get("/api/chats/:id", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!chat) {
      return res.status(404).json({
        error: "Không tìm thấy cuộc trò chuyện."
      });
    }

    res.json({ chat });

  } catch (error) {
    res.status(400).json({
      error: "ID cuộc trò chuyện không hợp lệ."
    });
  }
});

// ================================
// DELETE CHAT
// ================================

app.delete("/api/chats/:id", authenticate, async (req, res) => {
  try {
    const result = await Chat.deleteOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!result.deletedCount) {
      return res.status(404).json({
        error: "Không tìm thấy cuộc trò chuyện."
      });
    }

    res.json({
      message: "Đã xóa cuộc trò chuyện."
    });

  } catch (error) {
    res.status(400).json({
      error: "Không thể xóa cuộc trò chuyện."
    });
  }
});

// ================================
// HEALTH CHECK
// ================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "NguyezCodex API",
    model: MODEL,
    keyConfigured: Boolean(API_KEY),
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
  });
});

// ================================
// START SERVER
// ================================

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log("--------------------------------");
      console.log("NguyezCodex API đang chạy");
      console.log(`Port: ${PORT}`);
      console.log(`Model: ${MODEL}`);
      console.log("API Key: Đã cấu hình");
      console.log("--------------------------------");
    });

  } catch (error) {
    console.error(
      "Server startup error:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
