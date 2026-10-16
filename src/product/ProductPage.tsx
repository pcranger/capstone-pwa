import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { focusActiveHeading, focusElement } from './focus';
import './product.css';

/** Give nested tools the same Back behavior as their visible Back button. */
export function useProductBack(active:boolean,onBack:()=>void) {
  useLayoutEffect(()=>{if(!active)return;const handler=(event:Event)=>{if(event.defaultPrevented)return;event.preventDefault();onBack();};window.addEventListener('crosswise-product-back',handler);return()=>window.removeEventListener('crosswise-product-back',handler);},[active,onBack]);
}

export function Page({title,onBack,children,actions}:{title:string;onBack?:()=>void;children:ReactNode;actions?:ReactNode}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{document.title=`${title} · CrossWise`;focusElement(heading.current);},[title]);
  return <section className="cw-page" aria-label={title}>
    <header className="cw-header">{onBack&&<button type="button" className="cw-back" onClick={onBack}>‹ Back</button>}
      <h1 ref={heading} tabIndex={-1}>{title}</h1><div>{actions}</div></header>
    <div className="cw-content">{children}</div>
  </section>;
}
export function Action({children,onClick,disabled=false,secondary=false,danger=false}:{children:ReactNode;onClick:()=>void;disabled?:boolean;secondary?:boolean;danger?:boolean}){
  return <button type="button" className={`cw-action${secondary?' cw-secondary':''}${danger?' cw-danger':''}`} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function Row({label,detail,onClick,disabled=false}:{label:string;detail?:string;onClick:()=>void;disabled?:boolean}){
  return <button type="button" className="cw-row" disabled={disabled} onClick={onClick}><span><strong>{label}</strong>{detail&&<small>{detail}</small>}</span><span aria-hidden="true">›</span></button>;
}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){
  return <p className={`cw-notice${error?' cw-error':''}`} role={error?'alert':'status'} aria-atomic="true">{children}</p>;
}
export function ConfirmDialog({title,children,onConfirm,onCancel,confirmLabel='Confirm',danger=false}:{title:string;children:ReactNode;onConfirm:()=>void;onCancel:()=>void;confirmLabel?:string;danger?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(()=>{const origin=document.activeElement as HTMLElement|null;const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close();requestAnimationFrame(()=>{if(origin?.isConnected&&!origin.closest('[inert], [aria-hidden="true"]'))focusElement(origin);else focusActiveHeading();});};},[]);
  useLayoutEffect(()=>{const cancel=(event:Event)=>{event.preventDefault();onCancel();};window.addEventListener('crosswise-product-back',cancel,{capture:true});return()=>window.removeEventListener('crosswise-product-back',cancel,{capture:true});},[onCancel]);
  return <dialog ref={ref} className="cw-dialog" aria-labelledby={titleId} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }} onCancel={e=>{e.preventDefault();onCancel();}}><h2 id={titleId}>{title}</h2>{children}<div className="cw-actions"><Action secondary onClick={onCancel}>Cancel</Action><Action danger={danger} onClick={onConfirm}>{confirmLabel}</Action></div></dialog>;
}
