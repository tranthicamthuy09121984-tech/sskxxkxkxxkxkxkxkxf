
const { useState, useEffect, useRef } = React;

function NguyezCodex() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("GPT");
  const [language, setLanguage] = useState("vi");
  const [status, setStatus] = useState("Đang kiểm tra kết nối...");
  const [sidebar, setSidebar] = useState(true);
  const [page, setPage] = useState("home");

  const messagesEnd = useRef(null);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  async function checkConnection() {
    try {
      const response = await fetch("/api/health");
      const data = await response.json();

      setStatus(
        data.status === "online" && data.keyConfigured
          ? "Đã kết nối GPT"
          : "Backend hoạt động nhưng chưa có API Key"
      );
    } catch {
      setStatus("Không thể kết nối máy chủ");
    }
  }

  async function send() {
    const text = message.trim();

    if (!text || loading) return;

    if (model !== "GPT") {
      setMessages(prev => [
        ...prev,
        {
          role: "user",
          content: text
        },
        {
          role: "assistant",
          content: `${model} chưa được tích hợp API. Hiện tại chỉ hỗ trợ GPT.`
        }
      ]);

      setMessage("");
      return;
    }

    const updatedMessages = [
      ...messages,
      {
        role: "user",
        content: text
      }
    ];

    setMessages(updatedMessages);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          history,
          language
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi API");
      }

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.reply
        }
      ]);

      setHistory(prev => [
        ...prev,
        {
          role: "user",
          content: text
        },
        {
          role: "assistant",
          content: data.reply
        }
      ]);

      setStatus("GPT đang hoạt động");

    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ " + error.message
        }
      ]);

      setStatus("Có lỗi kết nối");
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setHistory([]);
    setMessage("");
    setPage("home");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  const languages = [
    ["vi", "Tiếng Việt"],
    ["en", "English"],
    ["ja", "日本語"],
    ["ko", "한국어"],
    ["zh", "中文"],
    ["fr", "Français"],
    ["es", "Español"],
    ["de", "Deutsch"],
    ["ru", "Русский"],
    ["th", "ไทย"],
    ["pt", "Português"]
  ];

  return (
    <div className="app">
      <aside className={`sidebar ${sidebar ? "" : "closed"}`}>
        <div className="brand">
          ✦ NguyezCodex
        </div>

        <button onClick={newChat}>
          ＋ Cuộc trò chuyện mới
        </button>

        <button onClick={() => setPage("search")}>
          ⌕ Tìm kiếm
        </button>

        <div className="sidebar-section">
          WORKSPACE
        </div>

        <button onClick={() => setPage("history")}>
          ◷ Lịch sử
        </button>

        <button onClick={() => setPage("documents")}>
          ▤ Tài liệu
        </button>

        <button onClick={() => setPage("learning")}>
          ✧ Lệnh học tập
        </button>

        <div className="sidebar-bottom">
          <button onClick={() => setPage("profile")}>
            👤 Hồ sơ
          </button>
          <small>NguyezCodex · AI for creativity and discovery</small>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <button onClick={() => setSidebar(!sidebar)}>
            ☰
          </button>

          <select
            value={model}
            onChange={e => setModel(e.target.value)}
          >
            <option>GPT</option>
            <option>Gemini</option>
            <option>Claude</option>
            <option>DeepSeek</option>
          </select>

          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {languages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </header>

        {page === "home" && (
          <>
            <section className="welcome">
              <h1>Chào mừng đến với NguyezCodex ✦</h1>
              <p>AI for creativity and discovery.</p>

              <div className="home-cards">
                {[
                  ["Lập trình", "Giúp tôi lập trình một website"],
                  ["Học tập", "Giúp tôi học một kiến thức mới"],
                  ["Sáng tạo", "Hãy giúp tôi sáng tạo ý tưởng"],
                  ["Phân tích", "Hãy phân tích vấn đề này"]
                ].map(([title, prompt]) => (
                  <button
                    className="home-card"
                    key={title}
                    onClick={() => setMessage(prompt)}
                  >
                    <strong>{title}</strong>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="chat-area">
              <div className="messages">
                {messages.map((item, index) => (
                  <div
                    key={index}
                    className={`message ${item.role}`}
                  >
                    <div className="message-name">
                      {item.role === "user"
                        ? "Bạn"
                        : "✦ NguyezCodex"}
                    </div>

                    <div className="message-content">
                      {item.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="message assistant">
                    ✦ GPT đang suy nghĩ...
                  </div>
                )}

                <div ref={messagesEnd} />
              </div>

              <div className="composer">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhắn tin với NguyezCodex..."
                  rows={2}
                />

                <button
                  onClick={send}
                  disabled={loading || !message.trim()}
                >
                  ↑ Gửi
                </button>
              </div>

              <div className="status">
                {status} · Đang chọn: {model}
              </div>
            </section>
          </>
        )}

        {page === "search" && (
          <section className="page">
            <h2>Tìm kiếm</h2>
            <input
              placeholder="Tìm kiếm trong NguyezCodex..."
              onChange={e => {
                // Có thể bổ sung tìm kiếm lịch sử tại đây.
              }}
            />
          </section>
        )}

        {page === "history" && (
          <section className="page">
            <h2>Lịch sử</h2>
            {messages.length === 0
              ? <p>Chưa có cuộc trò chuyện nào.</p>
              : messages.map((item, index) => (
                <p key={index}>
                  {item.role === "user" ? "Bạn: " : "GPT: "}
                  {item.content}
                </p>
              ))}
          </section>
        )}

        {page === "documents" && (
          <section className="page">
            <h2>Tài liệu</h2>
            <input type="file" multiple />
          </section>
        )}

        {page === "learning" && (
          <section className="page">
            <h2>Lệnh học tập</h2>
            <button onClick={() => {
              setPage("home");
              setMessage("Hãy tạo cho tôi một kế hoạch học tập.");
            }}>
              Tạo kế hoạch học tập
            </button>
          </section>
        )}

        {page === "profile" && (
          <section className="page">
            <h2>Hồ sơ</h2>
            <p>NguyezCodex User</p>
          </section>
        )}

        <footer>
          NguyezCodex · AI for creativity and discovery
        </footer>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(<NguyezCodex />);
