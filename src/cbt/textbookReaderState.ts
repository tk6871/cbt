import type {TextbookKey} from './textbookPages';

export type BookSelection={from:string;to:string;contentsId:string;contentsLabel:string};
const key='cbt-textbook-pages-v1';
export function readBookSelection(book:TextbookKey):BookSelection {
 let value:Partial<BookSelection>={};
 try{value=JSON.parse(localStorage.getItem(key)||'{}')[book]||{};}catch{}
 return {from:typeof value.from==='string'?value.from:book==='hansol'?'4-10':'442',to:typeof value.to==='string'?value.to:'',contentsId:typeof value.contentsId==='string'?value.contentsId:'',contentsLabel:typeof value.contentsLabel==='string'?value.contentsLabel:''};
}
export function saveBookSelection(book:TextbookKey,selection:BookSelection){
 try{const all=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...all,[book]:selection}));}catch{}
}
