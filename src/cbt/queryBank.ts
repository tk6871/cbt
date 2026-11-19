import {QueryClient} from '@tanstack/react-query';
import type {Catalog} from './types';

const catalogQueries = new QueryClient();
export function queryBank(base:string, key:string, read:()=>Promise<Catalog>) {
  return catalogQueries.fetchQuery({
    queryKey:['catalog',base,key],
    queryFn:read,
    staleTime:Infinity,
    retry:false,
  });
}
