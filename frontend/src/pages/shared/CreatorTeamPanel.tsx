import { ActionForm, Field, State, Status } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { isCustomerRole } from "../../lib/permissions";
import { post } from "../../services/api";
export type CreatorAssignment = { id: string; request_id: string; creator_id: string; proposal_id: string; work_scope: string; deadline: string | null; status: string; expires_at: string; response_note: string };
export type CreatorTeam = { selected: { creator_id: string; proposal_id: string }[]; assignments: CreatorAssignment[]; creators: { id: string; display_name: string; title: string; slug: string; avatar_url: string | null }[]; updates: { id: string; assignment_id: string; progress: number; content: string; created_at: string }[]; required: boolean };
export function CreatorTeamPanel({id, query, locked, onChanged}: {id:string; query:ReturnType<typeof useApi<CreatorTeam>>; locked:boolean; onChanged:()=>void}) {
 const {role}=useAuth(), customer=isCustomerRole(role), data=query.data;
 return <section className="panel creator-team-panel"><h2>Đội Creator phụ trách</h2><p className="muted">Có thể chọn nhiều Creator với phần việc riêng. Staff liên hệ đồng thời ngoài hệ thống; Creator tự xác nhận trong 5–15 phút. Đội đã chốt được lưu cùng báo giá và hợp đồng.</p><State query={query}>
  {!query.data?.selected.length && <p>Chưa có Creator được chọn trong đội.</p>}
  {data && data.selected.map(selected => {
   const creator=data.creators.find(c=>c.id===selected.creator_id), assignment=data.assignments.find(a=>a.creator_id===selected.creator_id);
   const expired=assignment?.status==='PENDING' && new Date(assignment.expires_at).getTime()<=Date.now();
   return <article className="team-member" key={selected.creator_id}><h3>{creator?.display_name || 'Creator'}</h3><p>{creator?.title}</p><Status value={expired?'EXPIRED':assignment?.status || 'UNASSIGNED'}/>
    {assignment && <><p className="preserve-lines">{assignment.work_scope}</p><p>Hạn bàn giao: {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString('vi-VN') : 'Chưa có'}</p>{assignment.status==='PENDING' && <p>Giữ chỗ đến {new Date(assignment.expires_at).toLocaleTimeString('vi-VN')}{expired && ' · Cần gửi lại lời mời'}</p>}{assignment.response_note && <p>{assignment.response_note}</p>}</>}
    {customer && !locked && !['PENDING','ACCEPTED'].includes(assignment?.status || '') && <ActionForm label="Bỏ chọn khỏi đội" showSuccess={false} onSubmit={()=>post(`/requests/${id}/team/deselect`,{proposal_id:selected.proposal_id})} onSuccess={onChanged}/>}
    {!customer && !locked && (!assignment || !['PENDING','ACCEPTED'].includes(assignment.status) || expired) && <details><summary>Phân công và mời xác nhận</summary><ActionForm label="Gửi lời mời nhận việc" onSubmit={f=>post(`/requests/${id}/team/invite`,{proposal_id:selected.proposal_id,work_scope:f.get('team-scope'),deadline:f.get('team-deadline'),response_minutes:Number(f.get('team-minutes'))})} onSuccess={onChanged}>
     <Field name="team-scope" label="Phần việc và đầu ra cụ thể" type="textarea" value={assignment?.work_scope}/><Field name="team-deadline" label="Hạn bàn giao" type="date" value={assignment?.deadline || undefined}/><label className="field">Thời gian giữ chỗ<select name="team-minutes" defaultValue="15"><option value="5">5 phút</option><option value="10">10 phút</option><option value="15">15 phút</option></select></label><p className="muted">Báo Creator ngay qua kênh của công ty. Lời mời chỉ được chấp nhận trong thời hạn giữ chỗ.</p>
    </ActionForm></details>}
    {!customer && !locked && assignment && ['PENDING','ACCEPTED'].includes(assignment.status) && <details><summary>Thu hồi phân công</summary><ActionForm label="Thu hồi phân công" onSubmit={f=>post(`/requests/${id}/team/release`,{assignment_id:assignment.id,reason:f.get('team-release')})} onSuccess={onChanged}><Field name="team-release" label="Lý do thu hồi" type="textarea"/></ActionForm></details>}
    {assignment && data.updates.filter(u=>u.assignment_id===assignment.id).slice(0,3).map(u=><p className="team-progress" key={u.id}><b>{u.progress}%</b> · {u.content}<small>{new Date(u.created_at).toLocaleString('vi-VN')}</small></p>)}
   </article>;
  })}
 </State></section>;
}
