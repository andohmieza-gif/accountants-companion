import { jsPDF } from "jspdf";
import type { ChatMessage, Conversation } from "@/components/sidebar";

export function stripHtmlForApi(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function messagePlainText(msg: ChatMessage): string {
  if (msg.isHtml) return stripHtmlForApi(msg.content);
  return msg.content;
}

export function exportConversationMarkdown(conv: Conversation): void {
  if (typeof window === "undefined") return;
  const blocks = conv.messages.map((m) => {
    const label = m.sender === "user" ? "You" : "Assistant";
    const body = messagePlainText(m).trim();
    return `## ${label}\n\n${body}\n`;
  });
  const md = `# ${conv.title}\n\n_Exported ${new Date().toLocaleString()}_\n\n${blocks.join("\n")}`;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = conv.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 48) || "chat";
  a.href = url;
  a.download = `${safe}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportConversationPdf(conv: Conversation): void {
  if (typeof window === "undefined") return;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(conv.title, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`Exported ${new Date().toLocaleString()}`, margin, y);
  y += 12;
  doc.setTextColor(0);

  for (const m of conv.messages) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const label = m.sender === "user" ? "You" : "Assistant";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, margin, y);
    y += 6;

    const body = messagePlainText(m).trim();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body, maxWidth);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 8;
  }

  const safe = conv.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 48) || "chat";
  doc.save(`${safe}.pdf`);
}
