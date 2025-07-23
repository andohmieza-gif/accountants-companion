import { useState } from "react";
import Head from "next/head";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage = { role: "user", content: input };
    setMessages([...messages, newMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();

      if (data.result) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.result },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I didn’t get that." },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error fetching response." },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>The Accountant's Companion</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div style={styles.container}>
        <div style={styles.chatBox}>
          <h1 style={styles.title}>Hi, I'm your Accounting Genius 👋</h1>
          <p style={styles.subtitle}>
            Ask me anything about GAAP, audit, tax, CPA, journal entries!
          </p>

          <div style={styles.messages}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.message,
                  backgroundColor:
                    msg.role === "user" ? "#e3e3e3" : "#d0ebff",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <span style={styles.msgRole}>
                  {msg.role === "user" ? "You" : "Accounting Genius"}
                </span>
                <p style={styles.msgText}>{msg.content}</p>
              </div>
            ))}
            {loading && <div style={styles.loader}>Thinking...</div>}
          </div>

          <div style={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              style={styles.input}
            />
            <button onClick={handleSend} style={styles.sendButton}>
              Send
            </button>
          </div>
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
    </>
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
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "20px",
  },
  chatBox: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "10px",
    padding: "20px",
    maxWidth: "700px",
    width: "100%",
    margin: "auto",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "24px",
    fontWeight: "600",
    marginBottom: "10px",
    color: "#222",
  },
  subtitle: {
    fontSize: "16px",
    color: "#444",
    marginBottom: "20px",
  },
  messages: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "50vh",
    overflowY: "auto",
    marginBottom: "20px",
  },
  message: {
    padding: "12px",
    borderRadius: "8px",
    maxWidth: "80%",
    wordBreak: "break-word",
  },
  msgRole: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "4px",
    display: "block",
  },
  msgText: {
    fontSize: "14px",
    color: "#222",
  },
  loader: {
    fontStyle: "italic",
    color: "#999",
  },
  inputRow: {
    display: "flex",
    gap: "10px",
    marginTop: "10px",
  },
  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "14px",
  },
  sendButton: {
    padding: "10px 18px",
    backgroundColor: "#0070f3",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
  },
  footer: {
    marginTop: "20px",
    textAlign: "center",
    fontSize: "14px",
    color: "#333",
  },
  link: {
    color: "#0070f3",
    textDecoration: "underline",
    marginLeft: "5px",
  },
};
