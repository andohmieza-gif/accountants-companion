import { useState, useEffect } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage = { role: "user", content: input, time: now };
    setChat((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    let reply = "";

    // Custom response to "who built this"
    if (/who\s+(built|made|created)\s+(you|this|chatbot|bot)/i.test(input)) {
      reply =
        `This chatbot was built by <a href="https://www.linkedin.com/in/mieza-morkye-andoh" target="_blank" style="color:#0070f3;">Mieza Andoh</a>, a CPA and accounting expert with deep experience in audit, tax, and financial reporting.`;
    } else {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input }),
        });
        const data = await res.json();
        reply = data.reply || "Sorry, I didn’t get that.";
      } catch (error) {
        reply = "Oops! Something went wrong.";
      }
    }

    const botMessage = {
      role: "bot",
      content: reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChat((prev) => [...prev, botMessage]);
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <h1 style={styles.title}>The Accountant’s Companion</h1>
        <p style={styles.subtitle}>
          Hi, I'm your <strong>Accounting Genius</strong>. Ask me anything about GAAP, audit, tax, CPA, or journal entries!
        </p>

        <div style={styles.chatBox}>
          {chat.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                ...(msg.role === "user" ? styles.userMessage : styles.botMessage),
              }}
            >
              <div
                style={styles.messageContent}
                dangerouslySetInnerHTML={{ __html: msg.content }}
              />
              <div style={styles.timestamp}>{msg.time}</div>
            </div>
          ))}
          {loading && (
            <div style={styles.botMessage}>
              <div className="spinner" style={styles.spinner}></div>
              <div style={styles.timestamp}>typing...</div>
            </div>
          )}
        </div>

        <div style={styles.inputSection}>
          <input
            type="text"
            placeholder="Type your accounting question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
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
    padding: "0.75rem",
    borderRadius: "6px",
    marginBottom: "0.5rem",
    position: "relative",
  },
  userMessage: {
    backgroundColor: "#d1e7ff",
    textAlign: "right",
  },
  botMessage: {
    backgroundColor: "#e2ffe8",
    textAlign: "left",
  },
  messageContent: {
    fontSize: "1rem",
  },
  timestamp: {
    fontSize: "0.75rem",
    color: "#555",
    marginTop: "0.25rem",
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
  spinner: {
    width: "24px",
    height: "24px",
    border: "3px solid #ccc",
    borderTop: "3px solid #0070f3",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "0.5rem",
  },
};

// CSS animation
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = 
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  ;
  document.head.appendChild(style);
}
