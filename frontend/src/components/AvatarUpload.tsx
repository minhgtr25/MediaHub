import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { ActionForm } from "./ui";

export function AvatarUpload() {
 const auth = useAuth(), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState("");
 useEffect(() => {
  if (!file) { setPreview(""); return; }
  const url = URL.createObjectURL(file); setPreview(url);
  return () => URL.revokeObjectURL(url);
 }, [file]);
 return <section className="profile-avatar-editor"><h3>Ảnh đại diện</h3>
  {preview || auth.profile?.avatar_url ? <img className="profile-avatar-preview" src={preview || auth.profile!.avatar_url!} alt="Ảnh đại diện" /> : <div className="profile-avatar-preview avatar-initials" aria-label="Chưa có ảnh đại diện">{auth.profile?.full_name.slice(0, 1)}</div>}
  <ActionForm label="Tải ảnh đại diện" onSubmit={async () => {
   if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Chọn ảnh JPG, PNG hoặc WEBP, tối đa 5 MB.");
   const body = new FormData(); body.append("file", file);
   await api("/auth/avatar", { method: "POST", body }); await auth.refresh(); setFile(null);
  }}><label className="field" htmlFor="avatar-file">Chọn ảnh · JPG, PNG, WEBP · tối đa 5 MB<input id="avatar-file" name="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => setFile(event.target.files?.[0] ?? null)} /></label><p className="muted">Xem trước ảnh trước khi tải. Ảnh Creator được đồng bộ với hồ sơ công khai.</p></ActionForm>
 </section>;
}
