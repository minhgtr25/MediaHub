import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { CheckCheck, Paperclip, Reply, Send, X } from "lucide-react";
import { State, Status } from "../../components/ui";
import { chatActivity } from "../../components/ServiceChatLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { api, post } from "../../services/api";
import { supabase } from "../../lib/supabase";
import { isReadByOtherMembers, mergeMessages } from "../../lib/messaging";
import { canReplyTo } from "../../lib/service-chat";
import type {
  Cursor,
  RequestMessage,
  RequestMessages,
} from "../../types/requests";
import { CommerceMessageLink } from "./RequestCommercePanel";
import { MessageFile, MessageText } from "./RequestMessageContent";
const roleName: Record<string, string> = {
  CUSTOMER: "KhÃ¡ch hÃ ng",
  BUSINESS: "KhÃ¡ch hÃ ng",
  STAFF: "Staff",
  ADMIN: "Admin",
  CREATOR: "Creator",
  STUDENT_CREATOR: "Creator",
};
export function RequestConversation({
  id,
  conversationId,
  closed,
  onActivity,
  basePath = `/service-chat/${id}`,
  title = "Há»™i thoáº¡i dá»‹ch vá»¥",
  staffName = "Chá» Staff tiáº¿p nháº­n",
  staffAvatar,
  status,
}: {
  id: string;
  conversationId: string;
  closed: boolean;
  onActivity: () => void;
  basePath?: string;
  title?: string;
  staffName?: string;
  staffAvatar?: string | null;
  status?: string;
}) {
  const { profile, role } = useAuth(),
    query = useApi<RequestMessages>(`${basePath}/messages`, true);
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [readError, setReadError] = useState("");
  const [history, setHistory] = useState<{
    messages: RequestMessage[];
    senders: RequestMessages["senders"];
    loaded: boolean;
    next: Cursor | null;
  }>({ messages: [], senders: [], loaded: false, next: null });
  const [historyBusy, setHistoryBusy] = useState(false),
    [historyError, setHistoryError] = useState("");
  const [audience, setAudience] = useState<"TEAM" | "CUSTOMER_STAFF">("TEAM");
  const creator = role === "CREATOR" || role === "STUDENT_CREATOR";
  const [reply, setReply] = useState<RequestMessage | null>(null),
    [file, setFile] = useState<File | null>(null),
    [filePreview, setFilePreview] = useState("");
  const sendKey = useRef<{
      context: string;
      key: string;
      file: File | null;
    } | null>(null),
    fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setFilePreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const followBottom = useRef(true);
  const olderPosition = useRef<{ height: number; top: number } | null>(null);
  const lock = useRef(false),
    historyLock = useRef(false),
    active = useRef(true),
    viewport = useRef<HTMLDivElement>(null);
  const activity = useRef(onActivity);
  useLayoutEffect(() => {
    if (olderPosition.current && viewport.current) {
      viewport.current.scrollTop =
        olderPosition.current.top +
        viewport.current.scrollHeight -
        olderPosition.current.height;
      olderPosition.current = null;
    }
  }, [history.messages]);
  useEffect(() => {
    activity.current = onActivity;
  }, [onActivity]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const realtime = supabase,
      channel = realtime
        .channel(`request-conversation:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversation_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            query.reload();
            chatActivity();
          },
        )
        .subscribe();
    return () => {
      void realtime.removeChannel(channel);
    };
  }, [conversationId]);
  useAutoRefresh(
    () => {
      query.reload();
      chatActivity();
    },
    { intervalMs: 45000, listenVisibilityChange: true, resetKey: id },
  );
  useEffect(() => {
    let live = true;
    if (query.data && !query.error && document.visibilityState === "visible") {
      void post(`${basePath}/read`)
        .then(() => {
          if (live) {
            setReadError("");
            chatActivity();
          }
        })
        .catch(() => {
          if (live)
            setReadError(
              "ChÆ°a cáº­p nháº­t Ä‘Æ°á»£c tráº¡ng thÃ¡i Ä‘Ã£ Ä‘á»c.",
            );
        });
      if (followBottom.current)
        viewport.current?.scrollTo({
          top: viewport.current.scrollHeight,
          behavior: "smooth",
        });
    }
    return () => {
      live = false;
    };
  }, [id, query.data, query.error]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || closed || (!draft.trim() && !file)) return;
    if (reply && !canReplyTo(reply.audience, audience, creator)) {
      setError(
        "Tin Ä‘Æ°á»£c tráº£ lá»i chá»‰ dÃ nh cho Customer vÃ  Staff. Äá»•i ngÆ°á»i nháº­n hoáº·c bá» tráº£ lá»i.",
      );
      return;
    }
    const context = JSON.stringify([draft.trim(), audience, reply?.id || null]);
    if (
      !sendKey.current ||
      sendKey.current.context !== context ||
      sendKey.current.file !== file
    )
      sendKey.current = { context, key: crypto.randomUUID(), file };
    const payload = {
      content: draft.trim(),
      audience: creator ? "TEAM" : audience,
      reply_to_id: reply?.id || null,
      client_message_id: sendKey.current.key,
    };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (file) {
        const body = new FormData();
        body.append("payload", JSON.stringify(payload));
        body.append("file", file);
        await api(`${basePath}/files`, { method: "POST", body });
      } else await post(`${basePath}/message`, payload);
      if (active.current) {
        setDraft("");
        setFile(null);
        setReply(null);
        sendKey.current = null;
        if (fileInput.current) fileInput.current.value = "";
        followBottom.current = true;
        query.reload();
        chatActivity();
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  const cursor = history.loaded ? history.next : query.data?.next_cursor;
  async function older() {
    if (!cursor || historyLock.current) return;
    historyLock.current = true;
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const result = await api<RequestMessages>(
        `${basePath}/messages?${new URLSearchParams(cursor)}`,
      );
      if (active.current) {
        if (viewport.current)
          olderPosition.current = {
            height: viewport.current.scrollHeight,
            top: viewport.current.scrollTop,
          };
        followBottom.current = false;
        setHistory((previous) => ({
          loaded: true,
          next: result.next_cursor,
          messages: mergeMessages(previous.messages, result.messages),
          senders: [...previous.senders, ...result.senders],
        }));
      }
    } catch (e) {
      if (active.current) setHistoryError((e as Error).message);
    } finally {
      historyLock.current = false;
      if (active.current) setHistoryBusy(false);
    }
  }
  const messages = mergeMessages(history.messages, query.data?.messages ?? []),
    senders = [...(query.data?.senders ?? []), ...history.senders];
  const latest = query.data?.messages.at(-1);
  useEffect(() => {
    if (latest && latest.kind !== "TEXT") activity.current();
  }, [latest?.id]);
  return (
    <section className="panel request-conversation service-conversation">
      <header>
        <div className="service-conversation-heading">
          <div className="service-chat-avatar">
            {staffAvatar ? (
              <img src={staffAvatar} alt="" />
            ) : (
              <span>{staffName.slice(0, 1)}</span>
            )}
          </div>
          <div>
            <h2>{title}</h2>
            <p>
              Phá»¥ trÃ¡ch: {staffName}
              {status && <Status value={status} />}
            </p>
          </div>
        </div>
      </header>
      <State query={query}>
        <div
          ref={viewport}
          className="request-message-history"
          onScroll={(e) => {
            const el = e.currentTarget;
            followBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
          aria-label="Lá»‹ch sá»­ trao Ä‘á»•i"
        >
          {cursor && (
            <button
              className="btn btn-ghost"
              disabled={historyBusy}
              onClick={older}
            >
              {historyBusy ? "Äang táº£iâ€¦" : "Xem tin nháº¯n trÆ°á»›c"}
            </button>
          )}
          {historyError && (
            <p className="error" role="alert">
              {historyError}
            </p>
          )}
          {messages.map((m) =>
            m.kind !== "TEXT" ? (
              <p className="request-system-event" key={m.id}>
                {m.content}
                <span
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a[href^="#"]'))
                      window.dispatchEvent(new Event("mediahub:chat-tools"));
                  }}
                >
                  <CommerceMessageLink kind={m.kind} metadata={m.event_data} />
                </span>
                <small>{new Date(m.created_at).toLocaleString("vi-VN")}</small>
              </p>
            ) : (
              <article
                className={`request-message ${m.sender_id === profile?.id ? "mine" : ""}`}
                key={m.id}
              >
                <strong>
                  {senders.find((s) => s.id === m.sender_id)?.full_name ||
                    "ThÃ nh viÃªn MediaHub"}{" "}
                  <span className="message-role">
                    {roleName[
                      senders.find((s) => s.id === m.sender_id)?.role || ""
                    ] || ""}
                  </span>
                </strong>
                {m.reply && (
                  <blockquote className="message-reply">
                    <strong>
                      {senders.find((s) => s.id === m.reply?.sender_id)
                        ?.full_name || "ThÃ nh viÃªn MediaHub"}
                    </strong>
                    <p>{m.reply.content.slice(0, 200)}</p>
                  </blockquote>
                )}
                <p>
                  <MessageText text={m.content} />
                </p>
                {m.file && <MessageFile file={m.file} basePath={basePath} />}
                <small>
                  {m.audience === "CUSTOMER_STAFF" && "Customer Â· Staff Â· "}
                  {new Date(m.created_at).toLocaleString("vi-VN")}
                  {m.sender_id === profile?.id &&
                    isReadByOtherMembers(
                      m,
                      (query.data?.members ?? []).filter(
                        (member) =>
                          m.audience !== "CUSTOMER_STAFF" ||
                          !["CREATOR", "STUDENT_CREATOR"].includes(
                            senders.find((s) => s.id === member.id)?.role || "",
                          ),
                      ),
                    ) && (
                      <CheckCheck
                        aria-label="CÃ¡c thÃ nh viÃªn khÃ¡c Ä‘Ã£ Ä‘á»c"
                        size={13}
                      />
                    )}
                </small>
                {!closed && (
                  <button
                    type="button"
                    className="btn btn-ghost message-reply-action"
                    onClick={() => {
                      setReply(m);
                      if (m.audience === "CUSTOMER_STAFF")
                        setAudience("CUSTOMER_STAFF");
                    }}
                  >
                    <Reply size={13} />
                    Tráº£ lá»i
                  </button>
                )}
              </article>
            ),
          )}
          {!messages.length && (
            <div className="service-chat-empty">
              <h3>Báº¯t Ä‘áº§u trao Ä‘á»•i táº¡i Ä‘Ã¢y</h3>
              <p>
                Staff Ä‘á»“ng hÃ nh trong há»™i thoáº¡i nÃ y tá»« tÆ° váº¥n
                Ä‘áº¿n bÃ n giao.
              </p>
            </div>
          )}
        </div>
      </State>
      {readError && (
        <p className="muted" role="status">
          {readError}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error} Ná»™i dung chÆ°a gá»­i Ä‘Æ°á»£c giá»¯ láº¡i.
        </p>
      )}
      {closed ? (
        <p>
          YÃªu cáº§u Ä‘Ã£ Ä‘Ã³ng; há»™i thoáº¡i Ä‘Æ°á»£c giá»¯ Ä‘á»ƒ xem láº¡i.
        </p>
      ) : (
        <form className="request-composer service-composer" onSubmit={send}>
          {!creator && (
            <label className="composer-audience">
              NgÆ°á»i nháº­n
              <select
                value={audience}
                disabled={busy}
                onChange={(e) =>
                  setAudience(e.target.value as "TEAM" | "CUSTOMER_STAFF")
                }
              >
                <option value="TEAM">
                  Cáº£ Ä‘á»™i Â· Creator tham gia sau há»£p Ä‘á»“ng
                </option>
                <option value="CUSTOMER_STAFF">Customer & Staff</option>
              </select>
            </label>
          )}
          {reply && (
            <div className="composer-reply">
              <span>
                Tráº£ lá»i{" "}
                {senders.find((s) => s.id === reply.sender_id)?.full_name ||
                  "thÃ nh viÃªn"}
                : {reply.content.slice(0, 160)}
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label="Bá» tráº£ lá»i"
                onClick={() => setReply(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {reply && !canReplyTo(reply.audience, audience, creator) && (
            <p className="error" role="alert">
              Tin nÃ y chá»‰ dÃ nh cho Customer vÃ  Staff; Ä‘á»•i ngÆ°á»i nháº­n
              hoáº·c bá» tráº£ lá»i.
            </p>
          )}
          {file && (
            <div className="composer-file">
              {filePreview && (
                <img src={filePreview} alt="áº¢nh chuáº©n bá»‹ gá»­i" />
              )}
              <span>
                {file.name} Â· {Math.ceil(file.size / 1024)} KB
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label="Bá» tá»‡p Ä‘Ã£ chá»n"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="service-composer-input">
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              id={`chat-file-${id}`}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov"
              disabled={busy || !query.data || !!query.error}
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (!selected) return;
                if (selected.size > 50 * 1024 * 1024 || selected.size === 0) {
                  setError("Tá»‡p pháº£i cÃ³ ná»™i dung vÃ  tá»‘i Ä‘a 50 MB.");
                  e.target.value = "";
                  return;
                }
                setError("");
                setFile(selected);
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="ÄÃ­nh kÃ¨m áº£nh hoáº·c tá»‡p"
              disabled={busy || !query.data || !!query.error}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={18} />
            </button>
            <label className="sr-only" htmlFor={`request-message-${id}`}>
              Tin nháº¯n
            </label>
            <textarea
              id={`request-message-${id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={5000}
              rows={2}
              placeholder="Nháº­p tin nháº¯nâ€¦"
              disabled={busy || !query.data || !!query.error}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              className="btn btn-primary"
              aria-label={busy ? "Äang gá»­i" : "Gá»­i tin nháº¯n"}
              disabled={
                busy ||
                !query.data ||
                !!query.error ||
                (!draft.trim() && !file) ||
                !!(reply && !canReplyTo(reply.audience, audience, creator))
              }
            >
              <Send size={18} />
            </button>
          </div>
          <small className="muted">
            Enter Ä‘á»ƒ gá»­i Â· Shift + Enter xuá»‘ng dÃ²ng Â· PDF, áº£nh,
            MP4/MOV tá»‘i Ä‘a 50 MB. Tá»‡p bÃ n giao dÃ¹ng má»¥c BÃ n giao.
          </small>
        </form>
      )}
    </section>
  );
}
