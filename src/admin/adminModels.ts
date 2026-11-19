export interface LoginModel {busy:boolean;error:string;submit:(name:string,password:string)=>void}

export interface ReviewAccess { url: string; token: () => Promise<string> }
