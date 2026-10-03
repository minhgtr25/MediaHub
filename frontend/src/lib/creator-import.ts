export type CreatorImportRow={creator_id:string;email:string;full_name:string;agreement_reference:string;signed_at:string};
const columns=['creator_id','email','full_name','agreement_reference','signed_at'] as const;
export function parseCreatorImport(source:string):CreatorImportRow[] {
 if(source.length>1024*1024) throw new Error('Tệp CSV tối đa 1 MB.');
 source=source.replace(/^\uFEFF/,'');
 const separator=source.split('\n')[0].includes(';') ? ';' : ',', rows:string[][]=[];
 let field='', row:string[]=[], quoted=false, afterQuote=false;
 function nextField(){row.push(field.trim());field='';afterQuote=false}
 function nextRow(){nextField();if(row.some(Boolean))rows.push(row);row=[]}
 for(let i=0;i<source.length;i++) {
  const char=source[i];
  if(quoted){if(char==='"'){if(source[i+1]==='"'){field+='"';i++}else{quoted=false;afterQuote=true}}else field+=char;continue}
  if(char==='"'){if(field.trim() || afterQuote) throw new Error('Dấu nháy trong CSV không hợp lệ.');quoted=true}
  else if(char===separator)nextField();
  else if(char==='\n')nextRow();
  else if(char==='\r')continue;
  else {if(afterQuote && char.trim())throw new Error('Dữ liệu sau dấu nháy đóng không hợp lệ.');field+=char}
 }
 if(quoted)throw new Error('CSV có ô chưa đóng dấu nháy.');
 if(field || row.length)nextRow();
 const header=rows.shift();
 if(!header || header.length!==columns.length || new Set(header).size!==columns.length || !columns.every(c=>header.includes(c)))throw new Error(`CSV cần đúng các cột: ${columns.join(', ')}.`);
 if(!rows.length || rows.length>50)throw new Error('Mỗi lần import từ 1 đến 50 Creator.');
 return rows.map((values,index)=>{
  if(values.length!==header.length || values.some(v=>!v))throw new Error(`Dòng ${index+2} thiếu hoặc thừa dữ liệu.`);
  return Object.fromEntries(header.map((c,i)=>[c,values[i]])) as CreatorImportRow;
 });
}
