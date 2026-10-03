import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { List, PanelRight, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { State, Status } from './ui';
import { requestsHome } from '../lib/requests';
import { ServiceChatResources } from '../pages/shared/ServiceChatResources';

type Item={id:string;title:string;status:string;assigned_staff:{full_name:string|null;avatar_url:string|null};preview:string|null;last_message_at:string|null;unread_count:number};
export const chatActivity=()=>window.dispatchEvent(new Event('mediahub:service-chat'));
export function ServiceConversationRail({currentId,active=true}:{currentId:string;active?:boolean}){
 const {role}=useAuth(),[search,setSearch]=useState(''),[term,setTerm]=useState(''),[page,setPage]=useState(1);
 const [visited,setVisited]=useState(active),wasActive=useRef(active);
 const query=useApi<{items:Item[];total:number}>(visited?`/service-chat/conversations?${new URLSearchParams({search:term,page:String(page)})}`:null);
 useEffect(()=>{if(active){setVisited(true);if(!wasActive.current&&visited)query.reload();}wasActive.current=active;},[active,visited]);
 useEffect(()=>{const timer=window.setTimeout(()=>{setTerm(search.trim());setPage(1);},300);return()=>window.clearTimeout(timer);},[search]);
 useEffect(()=>{const refresh=()=>{if(active&&document.visibilityState==='visible')query.reload();};window.addEventListener('mediahub:service-chat',refresh);return()=>window.removeEventListener('mediahub:service-chat',refresh);},[active]);
 return <nav className="service-chat-rail" aria-label="Hội thoại dịch vụ"><header><h2>Hội thoại dịch vụ</h2><label className="search-input"><Search size={16}/><input aria-label="Tìm hội thoại theo tên hoặc Staff" value={search} maxLength={150} onChange={e=>setSearch(e.target.value)} placeholder="Tìm hội thoại…"/></label></header>
  <State query={query}><div className="service-chat-items">{query.data?.items.map(item=><Link key={item.id} to={`${role==='CREATOR'||role==='STUDENT_CREATOR'?'/creator/requests':requestsHome(role)}/${item.id}`} className={item.id===currentId?'active':''} aria-current={item.id===currentId?'page':undefined}>
   <div className="service-chat-avatar">{item.assigned_staff?.avatar_url?<img src={item.assigned_staff.avatar_url} alt=""/>:<span>{(item.assigned_staff?.full_name||item.title).slice(0,1).toUpperCase()}</span>}</div><div className="service-chat-item-copy"><strong>{item.title}</strong><small>{item.assigned_staff?.full_name||'Chờ Staff tiếp nhận'}</small><p>{item.preview||'Chưa có tin nhắn'}</p><div><Status value={item.status}/>{item.last_message_at&&<time dateTime={item.last_message_at}>{new Date(item.last_message_at).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time>}</div></div>{item.unread_count>0&&<span className="service-unread" aria-label={`${item.unread_count} tin chưa đọc`}>{item.unread_count>99?'99+':item.unread_count}</span>}
  </Link>)}</div>{query.data?.items.length===0&&<p className="service-chat-empty">{term?'Không có hội thoại phù hợp.':'Chưa có hội thoại được cấp quyền.'}</p>}{query.data&&query.data.total>20&&<div className="service-chat-paging"><button className="btn btn-ghost" disabled={page===1} onClick={()=>setPage(v=>v-1)}>Trước</button><span>Trang {page}</span><button className="btn btn-ghost" disabled={page*20>=query.data.total} onClick={()=>setPage(v=>v+1)}>Sau</button></div>}</State>
 </nav>;
}

export function ServiceChatLayout({requestId,children,tools,enabled=true}:{requestId:string;children:ReactNode;tools:ReactNode;enabled?:boolean}){
 const {profile,role}=useAuth(),key=`mediahub:chat-panels:${profile?.id||''}:${role||''}`;
 const location=useLocation();
 const toolsDialog=useRef<HTMLDialogElement>(null);

 const leftButton=useRef<HTMLButtonElement>(null),rightButton=useRef<HTMLButtonElement>(null);
 const [panels,setPanels]=useState<{left:boolean;right:boolean}>(()=>{
  const initial={left:window.matchMedia('(min-width:1100px)').matches,right:false};
  try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value.left==='boolean'&&typeof value.right==='boolean'?{left:value.left,right:false}:initial;}catch{return initial;}
 });
 useEffect(()=>{
  const dialog=toolsDialog.current;if(!dialog)return;
  if(panels.right){if(!dialog.open)dialog.showModal();const section=document.getElementById(location.hash.slice(1));if(section&&dialog.contains(section))section.scrollIntoView({block:'start'});}
  else if(dialog.open)dialog.close();
 },[panels.right,location.hash]);

 useEffect(()=>{if(/^#(execution|variation|payment|contract|production|review|delivery|proposal|quote|commercial)/.test(location.hash))setPanels(current=>({...current,right:true}));},[location.hash]);
 useEffect(()=>{const open=()=>setPanels(current=>({...current,right:true}));window.addEventListener('mediahub:chat-tools',open);return()=>window.removeEventListener('mediahub:chat-tools',open);},[]);
 function toggle(side:'left'|'right'){
  const inside=document.getElementById(side==='left'?'service-chat-list-panel':'service-chat-tools-panel')?.contains(document.activeElement);
  setPanels(current=>{const next={...current,[side]:!current[side]};try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Layout remains usable without storage. */}return next;});
  if(inside)(side==='left'?leftButton:rightButton).current?.focus();
 }
 return <section className="service-chat-shell"><div className="service-chat-layout-actions"><button ref={leftButton} className="btn btn-ghost" aria-expanded={panels.left} aria-controls="service-chat-list-panel" onClick={()=>toggle('left')}><List size={17}/>{panels.left?'Ẩn danh sách':'Danh sách hội thoại'}</button><button ref={rightButton} className="btn btn-ghost" aria-expanded={panels.right} aria-controls="service-chat-tools-panel" onClick={()=>toggle('right')}><PanelRight size={17}/>{panels.right?'Ẩn công cụ':'Tài liệu & công cụ'}</button></div>
  <div className={`service-chat-grid ${panels.left?'with-list':''}`}>
   <div id="service-chat-list-panel" hidden={!panels.left}><button className="service-panel-close btn btn-ghost" onClick={()=>toggle('left')} aria-label="Đóng danh sách hội thoại"><X size={18}/></button><ServiceConversationRail currentId={requestId} active={panels.left}/></div>
   <div className="service-chat-main">{children}</div>
   <dialog ref={toolsDialog} id="service-chat-tools-panel" className="service-tools-dialog" aria-label="Tài liệu và công cụ hội thoại" onCancel={()=>setPanels(current=>({...current,right:false}))} onClose={()=>rightButton.current?.focus()}><button className="service-panel-close btn btn-ghost" onClick={()=>toggle('right')} aria-label="Đóng tài liệu và công cụ"><X size={18}/></button>{enabled&&<ServiceChatResources requestId={requestId} active={panels.right}/>}<div onClick={event=>{if((event.target as HTMLElement).closest('a[href^="#"]'))setPanels(current=>({...current,right:true}));}}>{tools}</div></dialog>
  </div>
 </section>;
}
