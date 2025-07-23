import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [
      ...messages,
      { sender: "user", text: input, time: new Date().toLocaleTimeString() },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    let reply = "";

    // Custom reply for builder question
    if (/who\s+built\s+(this|you)/i.test(input)) {
      reply =
        'This chatbot was built by Mieza Andoh. Connect with him on <a href="https://www.linkedin.com/in/mieza-morkye-andoh" target="_blank" style="color: #1d4ed8;">LinkedIn</a>.';
    } else if (/gaap/i.test(input)) {
      reply = `GAAP stands for Generally Accepted Accounting Principles. You can read more here: <a href="https://www.investopedia.com/terms/g/gaap.asp" target="_blank" style="color: #1d4ed8;">GAAP on Investopedia</a>.`;
    } else if (/cpa\s+(exam|license)/i.test(input)) {
      reply =
        'The CPA exam is a professional credentialing exam. Learn more: <a href="https://www.aicpa.org/becomeacpa" target="_blank" style="color: #1d4ed8;">Become a CPA - AICPA</a>.';
    } else {
      // Default API call
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input }),
        });

        const data = await res.json();
        reply = data.result || "Sorry, I didn’t get that.";
      } catch (error) {
        reply = "Sorry, there was an error. Try again.";
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        text: reply,
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Accounting Genius</h1>
      <p style={styles.subtitle}>
        Hi, I'm your Accounting Genius. Ask me anything about GAAP, audit, tax,
        CPA, journal entries!
      </p>

      <div style={styles.chatBox}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.message,
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              backgroundColor: msg.sender === "user" ? "#d1e7ff" : "#f0f0f0",
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: msg.text }} />
            <span style={styles.timestamp}>{msg.time}</span>
          </div>
        ))}
        {loading && <div style={styles.loading}>Typing...</div>}
      </div>

      <div style={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your accounting question here..."
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.button}>
          Send
        </button>
      </div>

      <footer style={styles.footer}>
        Built by{" "}
        <a
          href="https://www.linkedin.com/in/mieza-morkye-andoh"
          target="_blank"
          style={{ color: "#1d4ed8" }}
        >
          Mieza Andoh
        </a>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Inter', sans-serif",
    backgroundImage:
      "url('https://images.unsplash.com/photo-1588776814546-4a2b25c17388?auto=format&fit=crop&w=1400&q=80')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    minHeight: "100vh",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    color: "#000000",
  },
  title: {
    fontSize: "2rem",
    marginBottom: "5px",
  },
  subtitle: {
    marginBottom: "20px",
  },
  chatBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: "8px",
    padding: "15px",
    overflowY: "auto",
    maxHeight: "60vh",
  },
  message: {
    padding: "10px",
    borderRadius: "6px",
    maxWidth: "80%",
    fontSize: "1rem",
    wordBreak: "break-word",
  },
  timestamp: {
    fontSize: "0.75rem",
    color: "#555",
    marginTop: "4px",
    display: "block",
  },
  loading: {
    fontStyle: "italic",
    color: "#555",
  },
  inputContainer: {
    display: "flex",
    marginTop: "10px",
  },
  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "6px 0 0 6px",
    border: "1px solid #ccc",
    fontSize: "1rem",
  },
  button: {
    padding: "10px 15px",
    borderRadius: "0 6px 6px 0",
    border: "none",
    backgroundColor: "#1d4ed8",
    color: "#fff",
    cursor: "pointer",
  },
  footer: {
    marginTop: "15px",
    textAlign: "center",
    fontSize: "0.9rem",
    backgroundColor: "rgba(255,255,255,0.85)",
    padding: "10px",
    borderRadius: "6px",
  },
};
