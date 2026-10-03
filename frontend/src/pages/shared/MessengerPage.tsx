import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCheck, MessageCircle, Search, Send } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { State } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { supabase } from "../../lib/supabase";
import { post } from "../../services/api";
import { isReadByOtherMembers } from "../../lib/messaging";
import { workspaceHome } from "../../lib/permissions";
import { requestsHome } from "../../lib/requests";

type Person = { id: string; full_name: string; avatar_url: string | null; role: string; last_read_at?: string | null };
type Conversation = { id: string; subject: string; last_message_at: string; last_message_preview: string; unread: boolean; members: Person[] };
type Chat = { conversation: Conversation; members: Person[]; messages: { id: string; sender_id: string; content: string; created_at: string }[] };

function Avatar({ person }: { person?: Person }) {
  return person?.avatar_url ? <img src={person.avatar_url} alt="" /> : <span className="messenger-avatar" aria-hidden="true">{person?.full_name?.slice(0, 1).toUpperCase() || "M"}</span>;
}

function Composer({ id, disabled, onSent }: { id: string; disabled: boolean; onSent: () => void }) {
  const [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (lock.current || disabled || !content) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await post(`/messages/${id}/messages`, { content, attachments: [] });
      if (active.current) { setDraft(""); onSent(); }
    } catch (e) {
      if (active.current) setError((e as Error).message || "Không gửi được tin nhắn.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <>
    {error && <p className="messenger-feedback error" role="alert">{error} Nội dung chưa gửi được giữ lại.</p>}
    <form className="message-composer" onSubmit={send}>
      <textarea aria-label="Nội dung tin nhắn" value={draft} onChange={e => setDraft(e.target.value)} rows={1} maxLength={5000} placeholder="Nhập tin nhắn…" disabled={disabled || busy} onKeyDown={e => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
      }} />
      <button aria-label={busy ? "Đang gửi tin nhắn" : "Gửi tin nhắn"} disabled={disabled || busy || !draft.trim()}><Send /></button>
    </form>
  </>;
}

export function MessengerPage() {
  const { id } = useParams(), nav = useNavigate(), { profile, role } = useAuth();
  const [search, setSearch] = useState(""), [readError, setReadError] = useState("");
  const inbox = useApi<Conversation[]>("/messages"), chat = useApi<Chat>(id ? `/messages/${id}` : null);
  const end = useRef<HTMLDivElement>(null), selected = chat.data;
  const serviceHome = role === "CREATOR" || role === "STUDENT_CREATOR" ? workspaceHome(role) : requestsHome(role);
  const canSend = !!selected && ["STAFF", "ADMIN"].includes(role || "") && selected.members.length > 1 && selected.members.every(m => ["STAFF", "ADMIN"].includes(m.role));
  const peer = (members: Person[]) => members.find(x => x.id !== profile?.id) || members[0];
  useEffect(() => {
    if (!id || !supabase) return;
    const realtime = supabase;
    const channel = realtime.channel(`conversation:${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${id}` }, () => { chat.reload(); inbox.reload(); }).subscribe();
    return () => { void realtime.removeChannel(channel); };
  }, [id]);
  useEffect(() => {
    let active = true;
    setReadError("");
    if (id && chat.data) {
      void post(`/messages/${id}/read`).then(() => { if (active) inbox.reload(); }).catch(() => { if (active) setReadError("Chưa cập nhật được trạng thái đã đọc. Bạn vẫn có thể nhắn tin."); });
      end.current?.scrollIntoView({ behavior: "smooth" });
    }
    return () => { active = false; };
  }, [id, chat.data?.messages.at(-1)?.id]);
  const rows = (inbox.data || []).filter(c => `${c.subject} ${peer(c.members)?.full_name}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={`messenger ${id ? "chat-open" : ""}`}>
    <aside className="messenger-list">
      <header><div><h1>Lịch sử chat</h1><Link to={serviceHome}>Mở hội thoại dịch vụ →</Link></div><label><Search /><input aria-label="Tìm cuộc trò chuyện" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm cuộc trò chuyện" /></label></header>
      <State query={inbox}><div className="conversation-list">{rows.map(c => {
        const p = peer(c.members);
        return <button className={c.id === id ? "active" : ""} key={c.id} onClick={() => nav(`/messages/${c.id}`)}><span className="avatar-wrap"><Avatar person={p} /></span><span><strong>{p?.full_name || c.subject}</strong><small className={c.unread ? "unread" : ""}>{c.last_message_preview || "Bắt đầu cuộc trò chuyện"} · {relative(c.last_message_at)}</small></span>{c.unread && <b className="unread-dot" aria-label="Có tin chưa đọc" />}</button>;
      })}{!rows.length && <div className="no-conversations"><MessageCircle /><p>{search ? "Không tìm thấy cuộc trò chuyện phù hợp" : "Chưa có cuộc trò chuyện"}</p></div>}</div></State>
    </aside>
    <section className="messenger-chat">
      {!id ? <div className="messenger-welcome"><span><MessageCircle /></span><h2>Lịch sử trao đổi</h2><p>Trao đổi dịch vụ, tài liệu và tiến độ được lưu trong hội thoại của từng yêu cầu.</p><Link className="btn btn-primary" to={serviceHome}>Mở hội thoại dịch vụ</Link></div> : <>
        <State query={chat}>{selected && <>
          <header className="chat-header"><button className="back-chat" aria-label="Về danh sách cuộc trò chuyện" onClick={() => nav("/messages")}><ArrowLeft /></button><Avatar person={peer(selected.members)} /><div><strong>{peer(selected.members)?.full_name || selected.conversation.subject}</strong><small>{selected.members.map(m => m.full_name).join(", ")}</small></div></header>
          <div className="message-history"><div className="chat-intro"><Avatar person={peer(selected.members)} /><h2>{peer(selected.members)?.full_name || selected.conversation.subject}</h2><p>Cuộc trò chuyện dành cho các thành viên được cấp quyền.</p>{selected.messages.length >= 50 && <p>Đang hiển thị 50 tin nhắn gần nhất.</p>}</div>
            {!selected.messages.length && <p className="messenger-feedback">Chưa có tin nhắn trong lịch sử.</p>}
            {selected.messages.map((m, i) => {
              const mine = m.sender_id === profile?.id, sender = selected.members.find(x => x.id === m.sender_id), next = selected.messages[i + 1];
              const read = mine && isReadByOtherMembers(m, selected.members);
              return <div className={`message-row ${mine ? "mine" : ""}`} key={m.id}>{!mine && <Avatar person={sender} />}<div><p>{m.content}</p>{(!next || next.sender_id !== m.sender_id) && <small>{new Date(m.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{read && <CheckCheck aria-label="Các thành viên khác đã đọc" />}</small>}</div></div>;
            })}<div ref={end} />
          </div>
        </>}</State>
        {readError && <p className="messenger-feedback" role="status">{readError}</p>}
        {selected && !canSend && <p className="messenger-feedback">Lịch sử được giữ để tra cứu. <Link to={serviceHome}>Tiếp tục trao đổi trong hội thoại dịch vụ →</Link></p>}
        {canSend && <Composer key={id} id={id} disabled={chat.loading || !!chat.error} onSent={() => { chat.reload(); inbox.reload(); }} />}
      </>}
    </section>
  </main>;
}

function relative(value: string) {
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date) / 60000));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ`;
  return `${Math.floor(minutes / 1440)} ngày`;
}
