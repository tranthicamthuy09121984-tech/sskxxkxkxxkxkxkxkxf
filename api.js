
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
