import { useEffect, useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Add Inter font dynamically
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setChat([...chat, userMessage]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage.content }),
    });

    const data = await res.json();
    const botMessage = { role: "bot", content: data.reply };
    setChat((prev) => [...prev, botMessage]);
    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <h1 style={styles.title}>The Accountant’s Companion</h1>
        <p style={styles.subtitle}>
          Hi, I'm your <strong>Accounting Genius</strong>. Ask me anything about GAAP, audit, tax, CPA, or journal entries, etc!
        </p>

        <div style={styles.chatBox}>
          {chat.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                ...(
                  msg.role === "user" ? styles.userMessage : styles.botMessage
                ),
              }}
            >
              <span style={styles.icon}>
                {msg.role === "user" ? "🧑‍💼" : "🤖"}
              </span>
              <span>{msg.content}</span>
            </div>
          ))}
          {loading && (
            <div style={styles.botMessage}>
              <span style={styles.icon}>🤖</span> Typing...
            </div>
          )}
        </div>

        <div style={styles.inputSection}>
          <input
            type="text"
            placeholder="Type your accounting question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={styles.input}
          />
          <button onClick={sendMessage} style={styles.button}>
            Ask
          </button>
        </div>

        <footer style={styles.footer}>
          Built by{" "}
          <a
            href="https://www.linkedin.com/in/mieza-morkye-andoh"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Mieza Andoh
          </a>
        </footer>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    backgroundColor: "#f5f5f5",
    fontFamily: "'Inter', sans-serif",
    minHeight: "100vh",
    padding: "1rem",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  container: {
    background: "#ffffff",
    padding: "1.5rem",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "700px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "2rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
    color: "#000",
  },
  subtitle: {
    fontSize: "1rem",
    marginBottom: "1.5rem",
    color: "#333",
  },
  chatBox: {
    backgroundColor: "#f0f0f0",
    padding: "1rem",
    borderRadius: "8px",
    minHeight: "250px",
    maxHeight: "400px",
    overflowY: "auto",
    marginBottom: "1rem",
  },
  message: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    padding: "0.75rem",
    borderRadius: "6px",
    marginBottom: "0.5rem",
  },
  userMessage: {
    backgroundColor: "#d1e7ff",
  },
  botMessage: {
    backgroundColor: "#e2ffe8",
  },
  icon: {
    fontSize: "1.25rem",
    minWidth: "1.5rem",
  },
  inputSection: {
    display: "flex",
    flexDirection: "row",
    gap: "0.5rem",
    marginTop: "1rem",
    flexWrap: "wrap",
  },
  input: {
    flexGrow: 1,
    padding: "0.75rem",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "1rem",
    minWidth: "200px",
  },
  button: {
    backgroundColor: "#0070f3",
    color: "#fff",
    border: "none",
    padding: "0.75rem 1.25rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "1rem",
  },
  footer: {
    marginTop: "2rem",
    fontSize: "0.9rem",
    textAlign: "center",
    color: "#666",
  },
  link: {
    color: "#0070f3",
    textDecoration: "none",
    fontWeight: "600",
  },
};
