import { useEffect, useRef, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { Pagination, State } from '../../components/ui';
import type { ChatFile } from '../../types/requests';

type Resources={members:{id:string;full_name:string;role:string;avatar_url:string|null}[];files:ChatFile[];total:number};
export function ServiceChatResources({requestId,active}:{requestId:string;active:boolean}){
 const [visited,setVisited]=useState(active),[page,setPage]=useState(1),[error,setError]=useState('');
 const wasActive=useRef(active);
 useEffect(()=>{if(active)setVisited(true);},[active]);
 const query=useApi<Resources>(visited?`/service-chat/${requestId}/resources?page=${page}`:null);
 useEffect(()=>{if(active&&!wasActive.current&&visited)query.reload();wasActive.current=active;},[active,visited]);
 useEffect(()=>{const refresh=()=>{if(active&&document.visibilityState==='visible')query.reload();};window.addEventListener('mediahub:service-chat',refresh);return()=>window.removeEventListener('mediahub:service-chat',refresh);},[active]);
 async function open(file:ChatFile){setError('');try{const data=await api<{signedUrl:string}>(`/service-chat/${requestId}/files/${file.message_id}`);window.open(data.signedUrl,'_blank','noopener,noreferrer');}catch(e){setError((e as Error).message);}}
 return <section className="panel service-chat-resources"><h2>Thành viên &amp; tệp trao đổi</h2><State query={query}>{query.data&&<>
  <details><summary>Thành viên đang tham gia ({query.data.members.length})</summary>{query.data.members.map(person=><div className="service-chat-person" key={person.id}>{person.avatar_url&&<img src={person.avatar_url} alt=""/>}<span>{person.full_name}<small>{['CREATOR','STUDENT_CREATOR'].includes(person.role)?'Creator':['CUSTOMER','BUSINESS'].includes(person.role)?'Khách hàng':person.role==='ADMIN'?'Admin':'Staff'}</small></span></div>)}</details>
  <details><summary>File phương tiện &amp; tệp ({query.data.total})</summary>{query.data.files.map(file=><button key={file.message_id} className="btn btn-ghost service-resource-file" onClick={()=>open(file)}>{file.file_name}<small>{Math.ceil(file.file_size/1024)} KB</small></button>)}{query.data.total===0&&<p className="muted">Chưa có tệp gửi trong hội thoại.</p>}{query.data.total>10&&<Pagination page={page} total={query.data.total} limit={10} onChange={setPage}/>}</details>
 </>}</State>{error&&<p role="alert" className="error">{error}</p>}</section>;
}
