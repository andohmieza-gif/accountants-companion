import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setChat([...chat, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();

      if (res.ok) {
        setChat((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setChat((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
      }
    } catch {
      setChat((prev) => [...prev, { role: "assistant", content: "Network error, please try again." }]);
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        backgroundImage: "url('https://images.unsplash.com/photo-1581091012184-7a0c0f0f9553')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "black",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem", textShadow: "2px 2px 6px black" }}>
        The Accountant's Companion
      </h1>
      <p style={{ marginBottom: "2rem", fontSize: "1.2rem", maxWidth: 600, textShadow: "1px 1px 3px black" }}>
        Hi, I'm your Accounting Genius. Ask me anything about GAAP, audit, tax, CPA, journal entries!
      </p>

      <div
        style={{
          maxWidth: 700,
          backgroundColor: "rgba(255 255 255 / 0.9)",
          color: "#000",
          borderRadius: 12,
          padding: "1rem",
          minHeight: 300,
          overflowY: "auto",
          marginBottom: "1rem",
        }}
      >
        {chat.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              textAlign: msg.role === "user" ? "right" : "left",
            }}
          >
            <div
              style={{
                display: "inline-block",
                backgroundColor: msg.role === "user" ? "#0070f3" : "#e1e1e1",
                color: msg.role === "user" ? "white" : "#000",
                padding: "8px 14px",
                borderRadius: 18,
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <p>Thinking...</p>}
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 700, display: "flex", gap: 10 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your accounting question here..."
          style={{ flexGrow: 1, padding: "0.7rem 1rem", borderRadius: 12, border: "1px solid #ccc" }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "0.7rem 1.5rem",
            borderRadius: 12,
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </form>

      <footer style={{ marginTop: "2rem", fontSize: "0.9rem", color: "white", textShadow: "1px 1px 2px black" }}>
        Built by Mieza Andoh •{" "}
        <a
          href="https://www.linkedin.com/in/mieza-morkye-andoh"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "white", textDecoration: "underline" }}
        >
          LinkedIn
        </a>
      </footer>
    </div>
  );
}
