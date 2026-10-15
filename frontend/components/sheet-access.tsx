'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { useAccountProgress } from '../lib/account-progress';
export const guestAccessKey='a2z-explicit-guest-access';
export default function SheetAccess({account,children}:{account:ReturnType<typeof useAccountProgress>;children:ReactNode}){
 const router=useRouter();
 const [guest,setGuest]=useState<boolean|null>(null);
 const [special,setSpecial]=useState(false);
 useEffect(()=>{const update=()=>{try{setGuest(sessionStorage.getItem(guestAccessKey)==='true')}catch{setGuest(false)}};window.addEventListener('a2z-access-changed',update);const params=new URLSearchParams(window.location.search);const specialFlow=params.has('token')||params.has('error')||params.has('reset');setSpecial(specialFlow);let allowed=false;try{allowed=sessionStorage.getItem(guestAccessKey)==='true'}catch{}setGuest(allowed);if(specialFlow)router.replace('/login'+window.location.search);return()=>window.removeEventListener('a2z-access-changed',update)},[router]);
 useEffect(()=>{if(!account.loading&&guest!==null&&!account.user&&!guest&&!special)router.replace('/login'+window.location.search)},[account.loading,account.user,guest,special,router]);
 if(account.loading||guest===null||special||(!account.user&&!guest))return <div className="entry-loading" role="status"><span className="entry-logo">take<span>U</span>forward</span><p>{account.loading?'Checking your session…':'Opening sign in…'}</p></div>;
 return children;
}
