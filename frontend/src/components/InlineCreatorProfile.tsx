import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { State } from "./ui";
type Profile={display_name:string;bio:string;location:string;tools:string[];creator_skills:{skills:{id:string;name:string}}[];creator_portfolio:{id:string;title:string;description:string;thumbnail_url:string|null;gallery:string[];video_url:string|null}[]};
export function InlineCreatorProfile({slug, summary = "Xem hồ sơ và sản phẩm trong hội thoại"}: {slug:string; summary?:string}) {
 const [opened,setOpened]=useState(false);
 const query=useApi<Profile>(opened ? `/public/creators/${encodeURIComponent(slug)}` : null);
 return <details className="inline-creator-profile" onToggle={e=>setOpened(e.currentTarget.open)}><summary>{summary}</summary>{opened && <State query={query}>{query.data && <><p className="preserve-lines">{query.data.bio}</p><p>{query.data.location}</p><p>{query.data.creator_skills.map(s=>s.skills.name).join(' · ')}</p><p>Công cụ: {query.data.tools.join(', ') || 'Đang cập nhật'}</p>{query.data.creator_portfolio.slice(0,6).map(item=><article key={item.id}>{item.thumbnail_url && <img src={item.thumbnail_url} alt={item.title} loading="lazy"/>}<h4>{item.title}</h4><p>{item.description}</p>{item.gallery.slice(0,3).map(url=><img key={url} src={url} alt={item.title} loading="lazy"/>)}</article>)}</>}</State>}</details>;
}
