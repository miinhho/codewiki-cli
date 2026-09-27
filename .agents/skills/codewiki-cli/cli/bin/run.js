#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import{a as c}from"../chunk-OT6WBJR5.js";import{e as i}from"../chunk-LB3VBC7J.js";var e=i(c(),1);var o=class extends Error{constructor(t,s,n){super(s,n),this.code=t,this.name="CodeWikiError"}code};try{await(0,e.run)(process.argv.slice(2),import.meta.url)}catch(r){let s=r instanceof o||r instanceof Error&&r.name==="CodeWikiError"&&"code"in r?r.code:"CLI_ERROR",n=r instanceof Error?r.message:String(r);process.stderr.write(`${JSON.stringify({error:{code:s,message:n}})}
`),process.exitCode=1}finally{await(0,e.flush)()}
