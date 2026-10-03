import { useRef, useState } from "react";
import { Page, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { parseCreatorImport, type CreatorImportRow } from "../../lib/creator-import";
type Creator={id:string;display_name:string;title:string;account:{email:string;active:boolean}|null;agreement:{agreement_reference:string;signed_at:string}|null};
type Preview=CreatorImportRow & {display_name:string;action:string};
type Outcome={creator_id:string;email:string;provisioned:boolean;invitation_sent:boolean;error?:string};
const header='creator_id,email,full_name,agreement_reference,signed_at';
export function CreatorOnboardingPage() {
 const query=useApi<{items:Creator[]}>('/admin/creators'), [csv,setCsv]=useState(header+'\n'), [signed,setSigned]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
 const [preview,setPreview]=useState<Preview[]>([]), [outcomes,setOutcomes]=useState<Outcome[]>([]);
 const lock=useRef(false);
 const update=(text:string)=>{setCsv(text);setPreview([]);setOutcomes([]);setError('')};
 async function submit(mode:'preview'|'apply') {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try {
   if(!signed)throw new Error('Xác nhận đã đối chiếu hồ sơ hợp tác đã ký trước khi cấp tài khoản.');
   const data=await post('/admin/creators/import',{mode,confirm_signed:true,items:parseCreatorImport(csv)});
   if(mode==='preview')setPreview(data.items);else{setOutcomes(data.items);setPreview([]);query.reload()}
  }catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}
 }
 return <Page title="Cấp tài khoản Creator"><p>Import hồ sơ Creator đã ký hợp đồng hợp tác với công ty. Email mới nhận lời mời kích hoạt; tài khoản đã tồn tại được liên kết sau khi kiểm tra quyền và nghiệp vụ.</p>
  <section className="panel"><h2>Danh sách CSV</h2><p>Các cột: <code>{header}</code>. Dùng dấu phẩy hoặc chấm phẩy, tối đa 50 dòng. Thời điểm ký dùng ISO, ví dụ định dạng <code>YYYY-MM-DDT00:00:00+07:00</code>.</p><label className="field">Đọc tệp CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>1024*1024)throw new Error('Tệp tối đa 1 MB.');update(await file.text())}catch(err){setError((err as Error).message)}}}/></label>
   <label className="field">Nội dung CSV<textarea value={csv} disabled={busy} rows={9} onChange={e=>update(e.target.value)}/></label><label className="contract-checkbox"><input type="checkbox" checked={signed} disabled={busy} onChange={e=>{setSigned(e.target.checked);setPreview([])}}/><span>Tôi đã đối chiếu hợp đồng hợp tác đã ký, đúng Creator, email, mã hồ sơ và thời điểm ký.</span></label><p className="muted">Bước này ghi nhận hồ sơ do Admin kiểm tra; không tự tạo chữ ký điện tử. Lời mời tài khoản mới được gửi khi bấm cấp tài khoản.</p>
   <button className="btn btn-ghost" disabled={busy || !signed} onClick={()=>submit('preview')}>{busy?'Đang xử lý…':'Kiểm tra và xem trước'}</button>
   {error && <p className="error" role="alert">{error}</p>}
   {!!preview.length && <><div className="table-wrap"><table><thead><tr><th>Creator</th><th>Email</th><th>Hồ sơ hợp tác</th><th>Thao tác</th></tr></thead><tbody>{preview.map(r=><tr key={r.creator_id}><td>{r.display_name}</td><td>{r.email}</td><td>{r.agreement_reference}</td><td>{r.action==='INVITE_NEW'?'Gửi email mời tài khoản mới':'Liên kết tài khoản hiện có'}</td></tr>)}</tbody></table></div><button className="btn btn-primary" disabled={busy || !signed} onClick={()=>submit('apply')}>Cấp {preview.length} tài khoản theo danh sách đã kiểm tra</button></>}
   {outcomes.map(r=><p key={r.creator_id} className={r.provisioned?'':'error'} role="status"><b>{r.email}</b>: {r.provisioned ? `Đã cấp quyền${r.invitation_sent?' và gửi lời mời email':''}` : `Chưa cấp quyền. ${r.error}${r.invitation_sent?' Email lời mời đã gửi; cần kiểm tra lại hồ sơ trước khi thử lại.':''}`}</p>)}
  </section><section className="panel"><h2>Hồ sơ để liên kết</h2><p>Mã Creator là ID hồ sơ trong hệ thống. Dùng đúng mã bên dưới trong CSV; hồ sơ hợp tác đã ghi nhận được giữ nguyên.</p><State query={query}><div className="table-wrap"><table><thead><tr><th>Creator</th><th>Mã Creator</th><th>Tài khoản</th><th>Hồ sơ hợp tác</th></tr></thead><tbody>{query.data?.items.map(c=><tr key={c.id}><td>{c.display_name}<small>{c.title}</small></td><td><code>{c.id}</code></td><td>{c.account?.email || 'Chưa cấp'}{c.account && !c.account.active && ' · Đã tạm ngừng'}</td><td>{c.agreement?.agreement_reference || 'Chưa ghi nhận'}</td></tr>)}</tbody></table></div></State></section>
 </Page>;
}
