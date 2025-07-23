import { useState, useEffect } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setChat((prev) => [...prev, { sender: "user", content: input, time }]);
    setInput("");
    setLoading(true);

    let reply = "";
    const question = input.trim().toLowerCase();

    // Custom hardcoded answers
   if (/who (built|created|made) (this|you|the chatbot)/.test(question)) {
  reply = `This chatbot was built by <a href="https://www.linkedin.com/in/mieza-morkye-andoh" target="_blank" style="color: #0070f3;">Mieza Andoh</a>, a Certified Public Accountant and accounting expert. He specializes in financial reporting, audit, and tax services.`;
} else if (question.includes("gaap")) {
  reply = `GAAP stands for Generally Accepted Accounting Principles — a set of accounting standards companies follow when reporting financial data. It ensures consistency, comparability, and transparency in financial reporting. <br><br>
  📘 For more details, check out: <a href="https://www.investopedia.com/terms/g/gaap.asp" target="_blank" style="color:#0070f3;">GAAP Explained - Investopedia</a>`;
} else if (question.includes("cpa exam")) {
  reply = `The CPA Exam is a professional licensure exam for accountants in the U.S., testing knowledge in auditing, financial accounting, business concepts, and regulation. It's required to become a Certified Public Accountant. <br><br>
  📚 Learn more here: <a href="https://www.aicpa.org/resources/article/what-is-the-cpa-exam" target="_blank" style="color:#0070f3;">What is the CPA Exam - AICPA</a>`;
} else if (question.includes("audit")) {
  reply = `An audit is an independent review of financial statements to ensure accuracy and compliance with accounting standards like GAAP or IFRS. Auditors assess internal controls, verify transactions, and provide assurance to stakeholders. <br><br>
  🧾 Explore more: <a href="https://corporatefinanceinstitute.com/resources/accounting/audit/" target="_blank" style="color:#0070f3;">What is an Audit - CFI</a>`;
} else if (question.includes("tax")) {
  reply = `Tax accounting focuses on the preparation of tax returns and planning for future tax obligations. It uses rules set by tax authorities rather than general accounting principles. <br><br>
  💼 Visit: <a href="https://www.irs.gov/" target="_blank" style="color:#0070f3;">IRS Official Website</a>`;
} else {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input }),
        });
        const data = await res.json();
        reply = data.reply || "Sorry, I didn’t get that.";
      } catch {
        reply = "Oops! Something went wrong.";
      }
    }

    const botTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setChat((prev) => [...prev, { sender: "bot", content: reply, time: botTime }]);
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <h1 style={styles.title}>The Accountant’s Companion</h1>
        <p style={styles.subtitle}>
          Hi, I'm your <strong>Accounting Genius</strong>. Ask me anything about GAAP, audit, tax, CPA, journal entries and more!
        </p>

        <div style={styles.chatBox}>
          {chat.map((msg, idx) => (
            <div
              key={idx}
              style={{
                ...styles.message,
                ...(msg.sender === "user" ? styles.userMessage : styles.botMessage),
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
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

        <div style={styles.inputContainer}>
          <input
            type="text"
            placeholder="Type your accounting question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            style={styles.input}
            disabled={loading}
          />
          <button onClick={sendMessage} style={styles.button} disabled={loading}>
            Send
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
    wordBreak: "break-word",
  },
  userMessage: {
    backgroundColor: "#d1e7ff",
    alignSelf: "flex-end",
    textAlign: "right",
  },
  botMessage: {
    backgroundColor: "#e2ffe8",
    alignSelf: "flex-start",
    textAlign: "left",
  },
  timestamp: {
    fontSize: "0.75rem",
    color: "#555",
    marginTop: "0.25rem",
    textAlign: "right",
  },
  inputContainer: {
    display: "flex",
    marginTop: "1rem",
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
    backgroundColor: "#0070f3",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600",
  },
  footer: {
    marginTop: "1rem",
    textAlign: "center",
    fontSize: "0.9rem",
    color: "#666",
  },
  link: {
    color: "#0070f3",
    textDecoration: "underline",
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

if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
