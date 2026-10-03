import { useEffect, useRef } from "react";
// Refresh related data without remounting panels or discarding their drafts.
export function useOrderUpdates(id:string,reload:()=>void){
 const latest=useRef(reload);latest.current=reload;
 useEffect(()=>{const changed=(event:Event)=>{if((event as CustomEvent<string>).detail===id)latest.current();};window.addEventListener('mediahub:order-updated',changed);return()=>window.removeEventListener('mediahub:order-updated',changed);},[id]);
}
export function notifyOrderUpdated(id:string){window.dispatchEvent(new CustomEvent('mediahub:order-updated',{detail:id}));}
