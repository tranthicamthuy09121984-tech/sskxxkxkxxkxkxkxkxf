
const { useState, useEffect, useRef, useMemo } = React;

function NguyezCodex() {
  // ==============================
  // STATE
  // ==============================

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("GPT");
  const [language, setLanguage] = useState("vie");

  const [sidebar, setSidebar] = useState(true);
  const [page, setPage] = useState("home");

  const [status, setStatus] = useState("Đang kiểm tra kết nối...");
  const [profileName, setProfileName] = useState(
    localStorage.getItem("nguyezcodex_name") || ""
  );

  // Language
  const [languages, setLanguages] = useState([]);
  const [languageSearch, setLanguageSearch] = useState("");
  const [languageLoading, setLanguageLoading] = useState(true);
  const [languageError, setLanguageError] = useState("");

  const messagesEnd = useRef(null);

  // ==============================
  // LOAD LANGUAGES
  // ==============================

  useEffect(() => {
    let cancelled = false;

    async function loadLanguages() {
      try {
        setLanguageLoading(true);
        setLanguageError("");

        // Đặt file iso-639-3.json trong cùng repo với script.jsx
        const response = await fetch("./iso-639-3.json");

        if (!response.ok) {
          throw new Error("Không tìm thấy iso-639-3.json");
        }

        const raw = await response.json();

        const records = Array.isArray(raw)
          ? raw
          : raw.data || raw.records || raw.results || [];

        const parsed = records
          .map(item => {
            const code =
              item.Id ||
              item.id ||
              item["alpha3-b"] ||
              item["alpha3-t"] ||
              item.code;

            const name =
              item.Ref_Name ||
              item.English ||
              item.name ||
              item.Name;

            return {
              code: String(code || "").trim().toLowerCase(),
              name: String(name || "").trim()
            };
          })
          .filter(item => item.code && item.name);

        const unique = [
          ...new Map(
            parsed.map(item => [item.code, item])
          ).values()
        ].sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) {
          setLanguages(unique);

          if (!unique.some(item => item.code === "vie")) {
            setLanguage(unique[0]?.code || "eng");
          }
        }
      } catch (error) {
        console.error("Language loading error:", error);

        if (!cancelled) {
          setLanguageError(error.message);
        }
      } finally {
        if (!cancelled) {
          setLanguageLoading(false);
        }
      }
    }

    loadLanguages();

    return () => {
      cancelled = true;
    };
  }, []);

  // ==============================
  // SEARCH LANGUAGES
  // ==============================

  const filteredLanguages = useMemo(() => {
    const keyword = languageSearch
      .trim()
      .toLowerCase();

    if (!keyword) {
      return languages.slice(0, 100);
    }

    return languages
      .filter(item =>
        item.name.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword)
      )
      .slice(0, 100);
  }, [languages, languageSearch]);

  const selectedLanguage = languages.find(
    item => item.code === language
  );

  // ==============================
  // CHECK CONNECTION
  // ==============================

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    try {
      const response = await fetch("/api/health");
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Backend không hoạt động");
      }

      if (data.status === "online" && data.keyConfigured) {
        setStatus("Đã kết nối GPT");
      } else {
        setStatus("Backend hoạt động, chưa có API Key");
      }
    } catch {
      setStatus("Không thể kết nối máy chủ");
    }
  }

  // ==============================
  // SCROLL CHAT
  // ==============================

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, loading]);

  // ==============================
  // SEND MESSAGE
  // ==============================

  async function send() {
    const text = message.trim();

    if (!text || loading) return;

    const userMessage = {
      role: "user",
      content: text
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    if (model !== "GPT") {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content:
            `${model} hiện chưa được tích hợp API. ` +
            "Hiện tại NguyezCodex đang sử dụng GPT."
        }
      ]);

      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          history: history,
          language: language
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Không thể kết nối OpenAI API."
        );
      }

      const answer = data.reply;

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: answer
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
          content: answer
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

  // ==============================
  // NEW CHAT
  // ==============================

  function newChat() {
    if (loading) return;

    setMessages([]);
    setHistory([]);
    setMessage("");
    setPage("home");
  }

  // ==============================
  // KEYBOARD
  // ==============================

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  }

  // ==============================
  // PROFILE
  // ==============================

  function saveProfile() {
    const name = profileName.trim();

    if (!name) return;

    localStorage.setItem("nguyezcodex_name", name);
    setProfileName(name);

    alert("Đã lưu hồ sơ!");
  }

  // ==============================
  // QUICK PROMPTS
  // ==============================

  const quickPrompts = [
    {
      icon: "⌘",
      title: "Lập trình",
      description: "Giúp tôi lập trình một website",
      prompt: "Giúp tôi lập trình một website."
    },
    {
      icon: "✎",
      title: "Học tập",
      description: "Giúp tôi học kiến thức mới",
      prompt: "Hãy giúp tôi học một kiến thức mới."
    },
    {
      icon: "✧",
      title: "Sáng tạo",
      description: "Tạo ý tưởng độc đáo",
      prompt: "Hãy giúp tôi sáng tạo một ý tưởng độc đáo."
    },
    {
      icon: "⌕",
      title: "Phân tích",
      description: "Phân tích và giải thích",
      prompt: "Hãy phân tích vấn đề này."
    }
  ];

  // ==============================
  // RENDER
  // ==============================

  return (
    <div className="app">

      {/* SIDEBAR */}

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
            👤 {profileName || "Bạn"}
          </button>

          <small>
            NguyezCodex · AI for creativity and discovery
          </small>

        </div>
      </aside>

      {/* MAIN */}

      <main className="main">

        {/* HEADER */}

        <header className="header">

          <button onClick={() => setSidebar(!sidebar)}>
            ☰
          </button>

          <select
            value={model}
            onChange={e => setModel(e.target.value)}
          >
            <option value="GPT">GPT</option>
            <option value="Gemini">Gemini</option>
            <option value="Claude">Claude</option>
            <option value="DeepSeek">DeepSeek</option>
          </select>

          {/* LANGUAGE PICKER */}

          <div className="language-picker">

            <input
              type="search"
              placeholder={
                languageLoading
                  ? "Đang tải ngôn ngữ..."
                  : "⌕ Tìm ngôn ngữ..."
              }
              value={languageSearch}
              onChange={e =>
                setLanguageSearch(e.target.value)
              }
            />

            <select
              value={language}
              disabled={languageLoading || languages.length === 0}
              onChange={e => setLanguage(e.target.value)}
            >

              {filteredLanguages.map(item => (
                <option
                  key={item.code}
                  value={item.code}
                >
                  {item.name} ({item.code})
                </option>
              ))}

            </select>

            <small>
              {languageLoading
                ? "Đang tải dữ liệu..."
                : languageError
                  ? languageError
                  : `${languages.length.toLocaleString()} ngôn ngữ · Hiển thị tối đa 100 kết quả`}
            </small>

          </div>

        </header>

        {/* HOME */}

        {page === "home" && (

          <>

            <section className="welcome">

              <h1>
                Chào mừng đến với NguyezCodex ✦
              </h1>

              <p>
                AI for creativity and discovery.
              </p>

              <div className="home-cards">

                {quickPrompts.map(item => (

                  <button
                    className="home-card"
                    key={item.title}
                    onClick={() => setMessage(item.prompt)}
                  >

                    <strong>
                      {item.icon} {item.title}
                    </strong>

                    <span>
                      {item.description}
                    </span>

                  </button>

                ))}

              </div>

            </section>

            {/* CHAT */}

            <section className="chat-area">

              <div className="messages">

                {messages.length === 0 && (

                  <div className="empty-chat">
                    <h2>Bạn muốn khám phá điều gì?</h2>
                    <p>Hãy bắt đầu cuộc trò chuyện với NguyezCodex.</p>
                  </div>

                )}

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

              {/* INPUT */}

              <div className="composer">

                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhắn tin với NguyezCodex..."
                  rows={2}
                  disabled={loading}
                />

                <button
                  onClick={send}
                  disabled={loading || !message.trim()}
                >
                  {loading ? "..." : "↑ Gửi"}
                </button>

              </div>

              <div className="status">
                {status} · Đang chọn: {model}
                {" · "}
                {selectedLanguage?.name || language}
              </div>

            </section>

          </>

        )}

        {/* SEARCH */}

        {page === "search" && (

          <section className="page">

            <h2>Tìm kiếm</h2>

            <input
              placeholder="Tìm kiếm cuộc trò chuyện..."
              value={languageSearch}
              onChange={e => setLanguageSearch(e.target.value)}
            />

            <p>
              Tính năng tìm kiếm lịch sử có thể được mở rộng.
            </p>

          </section>

        )}

        {/* HISTORY */}

        {page === "history" && (

          <section className="page">

            <h2>Lịch sử</h2>

            {messages.length === 0 ? (

              <p>Chưa có cuộc trò chuyện nào.</p>

            ) : (

              messages.map((item, index) => (

                <div key={index} className="history-item">

                  <strong>
                    {item.role === "user" ? "Bạn" : "GPT"}
                  </strong>

                  <p>{item.content}</p>

                </div>

              ))

            )}

          </section>

        )}

        {/* DOCUMENTS */}

        {page === "documents" && (

          <section className="page">

            <h2>Tài liệu</h2>

            <input type="file" multiple />

          </section>

        )}

        {/* LEARNING */}

        {page === "learning" && (

          <section className="page">

            <h2>Lệnh học tập</h2>

            <button
              onClick={() => {
                setPage("home");
                setMessage(
                  "Hãy tạo cho tôi một kế hoạch học tập."
                );
              }}
            >
              Tạo kế hoạch học tập
            </button>

            <button
              onClick={() => {
                setPage("home");
                setMessage(
                  "Hãy giải thích một chủ đề lập trình từ cơ bản đến nâng cao."
                );
              }}
            >
              Học lập trình
            </button>

          </section>

        )}

        {/* PROFILE */}

        {page === "profile" && (

          <section className="page">

            <h2>Hồ sơ</h2>

            <label>Tên hiển thị</label>

            <input
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              placeholder="Nhập tên của bạn..."
            />

            <button onClick={saveProfile}>
              Lưu hồ sơ
            </button>

          </section>

        )}

        {/* FOOTER */}

        <footer>
          NguyezCodex · AI for creativity and discovery
        </footer>

      </main>

    </div>
  );
}

// ==============================
// MOUNT REACT
// ==============================

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(<NguyezCodex />);
