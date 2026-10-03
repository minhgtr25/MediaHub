export function canReplyTo(audience:string|undefined,recipient:string,creator=false){
 return audience!=='CUSTOMER_STAFF'||(!creator&&recipient==='CUSTOMER_STAFF');
}
export function messageTextParts(content:string):{text:string;href?:string}[]{
 const parts:{text:string;href?:string}[]=[];let offset=0;
 for(const match of content.matchAll(/https?:\/\/[^\s<>]+/g)){
  const index=match.index!;if(index>offset)parts.push({text:content.slice(offset,index)});
  let href:string|undefined;try{const url=new URL(match[0]);if(!url.username&&!url.password)href=url.href;}catch{/* Invalid URLs remain text. */}
  parts.push({text:match[0],href});offset=index+match[0].length;
 }
 if(offset<content.length)parts.push({text:content.slice(offset)});return parts;
}
