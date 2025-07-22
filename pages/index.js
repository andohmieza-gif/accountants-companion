import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setChat([...chat, userMessage]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    const botMessage = { role: "bot", content: data.reply };
    setChat((prev) => [...prev, botMessage]);
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>The Accountant’s Companion</h1>
      <p style={styles.welcome}>
        Hi, I'm your Accounting Genius. Ask me anything about GAAP, audit, tax, CPA, journal entries, and more!
      </p>

      <div style={styles.chatBox}>
        {chat.map((msg, i) => (
          <div key={i} style={msg.role === "user" ? styles.user : styles.bot}>
            <strong>{msg.role === "user" ? "You" : "Genius"}:</strong> {msg.content}
          </div>
        ))}
        {loading && <div style={styles.bot}>Genius: Typing...</div>}
      </div>

      <div style={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your accounting question..."
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.button}>Ask</button>
      </div>

      <footer style={styles.footer}>
        Built by Mieza Andoh <a href="https://www.linkedin.com/in/mieza-morkye-andoh" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    backgroundImage: `url('https://images.unsplash.com/photo-1588776814546-4a2b25c17388?auto=format&fit=crop&w=1400&q=80')`,
    backgroundSize: "cover",
    minHeight: "100vh",
    padding: "2rem",
    color: "white",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    textShadow: "1px 1px 2px black",
  },
  title: {
    fontSize: "2.5rem",
    marginBottom: "0.5rem",
  },
  welcome: {
    fontSize: "1.2rem",
    marginBottom: "2rem",
  },
  chatBox: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: "1rem",
    borderRadius: "8px",
    maxHeight: "50vh",
    overflowY: "auto",
    marginBottom: "1rem",
  },
  user: {
    marginBottom: "0.5rem",
    color: "#ffcc70",
  },
  bot: {
    marginBottom: "0.5rem",
    color: "#c0fdfb",
  },
  inputContainer: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "1rem",
  },
  input: {
    flex: 1,
    padding: "0.5rem",
    borderRadius: "4px",
    border: "none",
    fontSize: "1rem",
  },
  button: {
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    backgroundColor: "#00aaff",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
  footer: {
    marginTop: "2rem",
    fontSize: "0.9rem",
  },
};
