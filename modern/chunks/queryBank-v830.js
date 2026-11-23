import{Q as n}from"./queryClient-v830.js";const a=new n;function y(e,r,t){return a.fetchQuery({queryKey:["catalog",e,r],queryFn:t,staleTime:1/0,retry:!1})}export{y as queryBank};
