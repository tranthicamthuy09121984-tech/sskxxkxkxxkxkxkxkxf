
const API_BASE = "";

async function sendToNguyezCodex(message, history = [], language = "vi") {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      history,
      language
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Không thể kết nối AI.");
  }

  return data.reply;
}

// Ví dụ sử dụng
async function testNguyezCodex() {
  try {
    const answer = await sendToNguyezCodex(
      "Xin chào NguyezCodex!"
    );

    console.log("NguyezCodex:", answer);
  } catch (error) {
    console.error(error.message);
  }
}
