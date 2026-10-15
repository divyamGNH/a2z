'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, BookOpen, Cloud, ListChecks, Moon, Sun } from 'lucide-react';
import AccountPanel from '../../components/account-panel';
import { guestAccessKey } from '../../components/sheet-access';
import { useAccountProgress } from '../../lib/account-progress';
export default function LoginPage(){
 const account=useAccountProgress(),router=useRouter();
 const [dark,setDark]=useState(false);
 useEffect(()=>{try{setDark(localStorage.getItem('a2z-theme')==='dark')}catch{}},[]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(!account.loading&&account.user&&!params.has('token')&&!params.has('error')&&!params.has('reset'))router.replace('/')},[account.loading,account.user,router]);
 function toggleTheme(){setDark(d=>{try{localStorage.setItem('a2z-theme',d?'light':'dark')}catch{}return !d})}
 function viewGuest(){try{sessionStorage.setItem(guestAccessKey,'true');router.push('/')}catch{setGuestError('Guest access needs session storage enabled in this browser.')}}
 const [guestError,setGuestError]=useState('');
 return <div className={dark?'app dark login-page':'app login-page'}><header><div className="nav-wrap"><span className="brand"><span className="brand-icon">t<span>u</span>f</span><span>take<span className="orange">U</span>forward<span className="brand-caption">THE ORIGINAL SHEET</span></span></span><button className="icon-button login-theme" onClick={toggleTheme} aria-label={dark?'Switch to light theme':'Switch to dark theme'}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button></div></header><main className="login-layout"><section className="login-intro"><div className="eyebrow"><span/>YOUR DSA JOURNEY STARTS HERE</div><h1>One sheet.<br/>Every step forward<span className="orange">.</span></h1><p>The original Striver A2Z roadmap, with your progress right where you left it.</p><div className="login-benefits"><div><BookOpen size={20}/><span><strong>The complete original roadmap</strong><small>455 questions and lessons. 18 steps. One clear path.</small></span></div><div><ListChecks size={20}/><span><strong>Make every session count</strong><small>Track solved problems, revision stars and personal notes.</small></span></div><div><Cloud size={20}/><span><strong>Pick up on any device</strong><small>Sign in to keep your progress safely in your account.</small></span></div></div><span className="login-credit">An unofficial community archive · Teaching resources by Striver / takeUforward</span></section><section className="login-form-column" aria-label="Sign in or sign up"><AccountPanel account={account} standalone/><div className="guest-entry"><span>Want to look around first?</span><button onClick={viewGuest}>View the sheet as a guest <ArrowUpRight size={15}/></button><small>Guest progress is saved only in this browser.</small>{guestError&&<p role="alert">{guestError}</p>}</div></section></main></div>
}
