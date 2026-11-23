
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.OPENAI_API_KEYS;
const MODEL = process.env.OPENAI_MODEL || "gpt-6.2-astra";

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: {
    error: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau."
  }
}));


require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const OpenAI = require("openai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const User = require("./database/User");
const Chat = require("./database/Chat");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));
app.use(express.json({ limit: "1mb" }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100
}));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEYS
});

const PORT = process.env.PORT || 3001;

// DATABASE
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// AUTH MIDDLEWARE
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
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Phiên đăng nhập không hợp lệ."
    });
  }
}

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
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
    console.error(error);
    res.status(500).json({
      error: "Không thể đăng ký tài khoản."
    });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Thiếu email hoặc mật khẩu."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        error: "Email hoặc mật khẩu không chính xác."
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
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
    console.error(error);
    res.status(500).json({
      error: "Không thể đăng nhập."
    });
  }
});

// CURRENT USER
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
  } catch {
    res.status(500).json({
      error: "Không thể lấy thông tin tài khoản."
    });
  }
});

// CREATE CHAT
app.post("/api/chat", authenticate, async (req, res) => {
  try {
    const { message, chatId } = req.body;

    if (typeof message !== "string" || !message.trim()) {
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
      chat = await Chat.create({
        userId: req.user.userId,
        title: message.trim().slice(0, 60),
        messages: []
      });
    }

    const history = chat.messages.slice(-20).map(item => ({
      role: item.role,
      content: item.content
    }));

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Bạn là NguyezCodex, trợ lý AI hữu ích. Trả lời bằng ngôn ngữ người dùng đang sử dụng."
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

    chat.messages.push(
      { role: "user", content: message.trim() },
      { role: "assistant", content: answer }
    );

    chat.updatedAt = new Date();
    await chat.save();

    res.json({
      chatId: chat._id,
      reply: answer
    });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({
      error: "Không thể gửi tin nhắn đến GPT."
    });
  }
});

// CHAT HISTORY
app.get("/api/chats", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({
      userId: req.user.userId
    })
      .select("title updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100);

    res.json({ chats });
  } catch {
    res.status(500).json({
      error: "Không thể tải lịch sử."
    });
  }
});

// GET ONE CHAT
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
  } catch {
    res.status(400).json({
      error: "ID cuộc trò chuyện không hợp lệ."
    });
  }
});

// DELETE CHAT
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
  } catch {
    res.status(400).json({
      error: "Không thể xóa cuộc trò chuyện."
    });
  }
});

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    name: "NguyezCodex API",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected"
  });
});

app.listen(PORT, () => {
  console.log(`NguyezCodex API: http://localhost:${PORT}`);
});


// Kiểm tra kết nối backend
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "NguyezCodex API",
    model: MODEL,
    keyConfigured: Boolean(API_KEY)
  });
});

// Chat với OpenAI
app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "Chưa cấu hình OPENAI_API_KEYS trên máy chủ."
      });
    }

    const { message, history = [], language = "vi" } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Tin nhắn không được để trống."
      });
    }

    if (message.length > 12000) {
      return res.status(400).json({
        error: "Tin nhắn quá dài."
      });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-12)
          .filter(item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
          )
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 6000)
          }))
      : [];

    const input = [
      ...safeHistory,
      {
        role: "user",
        content: message.trim()
      }
    ];

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          instructions:
            `Bạn là NguyezCodex, một trợ lý AI hữu ích. ` +
            `Hãy trả lời bằng ngôn ngữ: ${language}.`,
          input,
          store: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error: data.error?.message || "OpenAI API gặp lỗi."
      });
    }

    const answer = (data.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    if (!answer) {
      return res.status(502).json({
        error: "AI không trả về nội dung."
      });
    }

    res.json({
      success: true,
      reply: answer,
      model: data.model
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      error: "Máy chủ gặp lỗi khi xử lý tin nhắn."
    });
  }
});

app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("NguyezCodex API đang chạy");
  console.log(`Port: ${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`API Key: ${API_KEY ? "Đã cấu hình" : "Chưa cấu hình"}`);
  console.log("--------------------------------");
});
