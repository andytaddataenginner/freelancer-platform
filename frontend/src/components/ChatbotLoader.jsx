import {useEffect} from 'react';

// Mounted once by App.jsx above the route tree, so the same original QFA
// role-aware chatbot is available on public, freelancer and client screens.
export function ChatbotLoader(){
 useEffect(()=>{
  const cssHref='/chatbot-widget.css';
  const scriptSrc='/chatbot-widget.js';
  if(!document.querySelector('link[data-qfa-chatbot]')){
   const css=document.createElement('link');
   css.rel='stylesheet';
   css.href=cssHref;
   css.dataset.qfaChatbot='true';
   document.head.appendChild(css);
  }
  let script=document.querySelector('script[data-qfa-chatbot]');
  if(script?.dataset.failed==='true'){
   script.remove();
   script=null;
  }
  if(!script){
   script=document.createElement('script');
   script.src=scriptSrc;
   script.async=true;
   script.dataset.qfaChatbot='true';
   script.addEventListener('error',()=>{
    script.dataset.failed='true';
    console.error('QFA chatbot could not load. Check that chatbot-widget.js is published with the frontend build.');
   },{once:true});
   document.body.appendChild(script);
  }
 },[]);
 return null;
}
