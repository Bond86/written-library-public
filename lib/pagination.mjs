export const SEARCH_PAGE_SIZE=20;
export function paginateResults(total,requestedPage=1){
 if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid result count');
 const pages=Math.max(1,Math.ceil(total/SEARCH_PAGE_SIZE));
 const parsed=/^[1-9]\d*$/u.test(String(requestedPage))?Number(requestedPage):1;
 const page=Math.min(pages,Number.isSafeInteger(parsed)?parsed:1);
 const start=total?(page-1)*SEARCH_PAGE_SIZE:0,end=Math.min(total,start+SEARCH_PAGE_SIZE);
 const selected=new Set([1,pages]);
 for(let n=Math.max(1,page-2);n<=Math.min(pages,page+2);n++)selected.add(n);
 if(pages<=7)for(let n=1;n<=pages;n++)selected.add(n);
 const items=[];
 for(const n of [...selected].sort((a,b)=>a-b)){
  const previous=items.at(-1);
  if(previous&&n-previous===2)items.push(previous+1);
  else if(previous&&n-previous>2)items.push(null);
  items.push(n);
 }
 return {page,pages,start,end,items};
}
