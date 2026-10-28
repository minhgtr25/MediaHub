import { useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { api } from "../../services/api";
import { messageTextParts } from "../../lib/service-chat";
import type { ChatFile } from "../../types/requests";

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {messageTextParts(text).map((part, index) =>
        part.href ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
export function MessageFile({
  file,
  basePath,
}: {
  file: ChatFile;
  basePath: string;
}) {
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function open() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ signedUrl: string }>(
        `${basePath}/files/${file.message_id}`,
      );
      if (file.file_type.startsWith("image/")) setUrl(data.signedUrl);
      else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="service-message-file">
      <p>
        <Paperclip size={14} />
        {file.file_name} · {Math.ceil(file.file_size / 1024)} KB
      </p>
      <button className="btn btn-ghost" onClick={open} disabled={busy}>
        <Download size={14} />
        {busy
          ? "Đang tải…"
          : file.file_type.startsWith("image/")
            ? "Xem ảnh"
            : "Mở tệp"}
      </button>
      {url && (
        <img
          src={url}
          alt={file.file_name}
          loading="lazy"
          onError={() => {
            setUrl("");
            setError(
              "Ảnh chưa tải được hoặc liên kết đã hết hạn. Bấm Xem ảnh để thử lại.",
            );
          }}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
