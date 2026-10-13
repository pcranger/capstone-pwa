import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';

const scrypt=promisify(scryptCallback);
const hash=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const cleanText=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):'';
const validPoint=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
function reply(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function bodyOf(req,max=700000){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>max)throw new ApiError(413,'The upload is too large.');}try{return JSON.parse(text);}catch{throw new ApiError(400,'Invalid request.');}}
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new ApiError(status,message);};
const publicUser=user=>({id:user.id,email:user.email,createdAt:user.createdAt});
const monthOf=now=>new Date(now).toISOString().slice(0,7);
const backupKeys=new Set(['crosswise_settings','crosswise_product_preferences_v1','crosswise_saved_places_v1','crosswise_saved_places_v2','crosswise_route_preference','crosswise_nearby_v1','crosswise_local_tools_v1','crosswise_recorder_settings_v1']);

/** Opt-in, single-process research backend. Deploy only behind HTTPS. No provider secrets reach the browser. */
export function createAdvancedHandler({dataDir=process.env.CROSSWISE_DATA_DIR??'',geminiKey=process.env.GEMINI_API_KEY??'',geminiModel=process.env.GEMINI_MODEL??'gemini-3.8-flash',upstream=fetch,now=Date.now,photoLimit=100,secureCookies=process.env.NODE_ENV==='production'}={}){
 let database={version:1,users:[],sessions:[],backups:[],shares:[],questions:[]};
 const file=dataDir?resolve(dataDir,'product-data.json'):null;
 let loadError=null;
 const ready=(async()=>{if(!file)return;try{await mkdir(resolve(dataDir),{recursive:true,mode:0o700});try{const stored=JSON.parse(await readFile(file,'utf8'));if(stored.version!==1||!['users','sessions','backups','shares','questions'].every(k=>Array.isArray(stored[k])))throw new Error('Unsupported data');database=stored;}catch(error){if(error.code!=='ENOENT')throw error;}}catch{loadError=new Error('Account storage is unavailable. Local use is still available.');}})();
 let chain=Promise.resolve();
 async function transaction(change){const operation=chain.then(async()=>{await ready;if(loadError)throw loadError;const copy=structuredClone(database);const result=await change(copy);const temporary=file+'.tmp';await writeFile(temporary,JSON.stringify(copy),{mode:0o600});await rename(temporary,file);database=copy;return result;});chain=operation.catch(()=>{});return operation;}
 const attempts=new Map();
 function limit(req){const key=req.socket.remoteAddress??'unknown',timestamp=now();let bucket=attempts.get(key);if(!bucket||timestamp-bucket.start>600000){bucket={start:timestamp,count:0};attempts.set(key,bucket);}if(++bucket.count>60)fail(429,'Too many account requests. Try again in ten minutes.');if(attempts.size>10000)for(const [id,item]of attempts)if(timestamp-item.start>600000)attempts.delete(id);}
 function auth(req){const value=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('crosswise_session='))?.slice(18);const session=value&&database.sessions.find(s=>s.tokenHash===hash(value)&&s.expiresAt>now());const user=session&&database.users.find(u=>u.id===session.userId);if(!user)fail(401,'Sign in to use this service.');return user;}
 function cookie(res,value,expire=false){res.setHeader('Set-Cookie',`crosswise_session=${value}; HttpOnly; SameSite=Strict; Path=/api/product; ${expire?'Max-Age=0':'Max-Age=604800'}${secureCookies?'; Secure':''}`);}
 async function newSession(res,user){const value=token();await transaction(db=>{db.sessions=db.sessions.filter(s=>s.expiresAt>now());db.sessions.push({tokenHash:hash(value),userId:user.id,expiresAt:now()+604800000});});cookie(res,value);}
 function viewShare(share,user){const owner=share.ownerId===user.id;if(!owner&&!share.viewerIds.includes(user.id))fail(403,'This sharing session is not available to this account.');const active=!share.revokedAt&&share.expiresAt>now();if(!owner&&!active)fail(410,'This sharing session has ended.');return {id:share.id,label:share.label,ownerId:share.ownerId,owner:owner,ownerEmail:database.users.find(u=>u.id===share.ownerId)?.email??'',expiresAt:share.expiresAt,revokedAt:share.revokedAt??null,viewerCount:share.viewerIds.length,position:active?share.position:null,checkIns:active?share.checkIns.slice(-30):[],invite:owner&&active?share.invite:null};}
 return async function advanced(req,res,url){
  if(!url.pathname.startsWith('/api/product/'))return false;
  try{
   await ready;
   const origin=req.headers.origin;if(origin){let host;try{host=new URL(origin).host;}catch{fail(403,'Request origin is not allowed.');}if(host!==req.headers.host)fail(403,'Request origin is not allowed.');}
   if(url.pathname==='/api/product/capabilities'&&req.method==='GET'){reply(res,200,{accounts:!!file&&!loadError,photoQuestions:!!file&&!loadError&&!!geminiKey,photoLimit,foregroundSharing:true,backgroundSharing:false,insurance:false,payments:false,headsetActions:false,storageError:!!loadError,model:geminiKey?geminiModel:null});return true;}
   if(!file)fail(503,'Accounts and sharing are not configured. Use local backup and navigation, or configure CROSSWISE_DATA_DIR on the server.');
   if(loadError)fail(503,loadError.message);
   const path=url.pathname.slice('/api/product'.length);
   if((path==='/register'||path==='/login')&&req.method==='POST'){
    limit(req);const incoming=await bodyOf(req,4096),email=cleanText(incoming.email,254).toLowerCase(),password=incoming.password;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>200)fail(400,'Enter an email address and a password of 12 to 200 characters.');
    let user;
    if(path==='/register'){const salt=randomBytes(16).toString('hex'),passwordHash=(await scrypt(password,salt,64)).toString('hex');user=await transaction(db=>{if(db.users.some(u=>u.email===email))fail(409,'That address already has an account. Sign in instead.');if(db.users.length>=1000)fail(503,'Account registration is full for this research server.');const result={id:randomUUID(),email,salt,passwordHash,createdAt:now()};db.users.push(result);return result;});}
    else{user=database.users.find(u=>u.email===email);const actual=await scrypt(password,user?.salt??'invalid-account-salt',64);if(!user||!timingSafeEqual(actual,Buffer.from(user.passwordHash,'hex')))fail(401,'Email or password is incorrect.');}
    await newSession(res,user);reply(res,200,{user:publicUser(user)});return true;
   }
   const user=auth(req);
   if(path==='/me'&&req.method==='GET'){const month=monthOf(now());reply(res,200,{user:publicUser(user),photoUsed:database.questions.filter(q=>q.ownerId===user.id&&q.month===month&&q.status!=='failed').length,photoLimit});return true;}
   if(path==='/logout'&&req.method==='POST'){const raw=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('crosswise_session='))?.slice(18);await transaction(db=>{db.sessions=db.sessions.filter(s=>s.tokenHash!==hash(raw??''));});cookie(res,'',true);reply(res,200,{ok:true});return true;}
   if(path==='/account'&&req.method==='DELETE'){await transaction(db=>{db.users=db.users.filter(u=>u.id!==user.id);db.sessions=db.sessions.filter(s=>s.userId!==user.id);db.backups=db.backups.filter(b=>b.ownerId!==user.id);db.questions=db.questions.filter(q=>q.ownerId!==user.id);db.shares=db.shares.filter(s=>s.ownerId!==user.id).map(s=>({...s,viewerIds:s.viewerIds.filter(id=>id!==user.id)}));});cookie(res,'',true);reply(res,200,{ok:true});return true;}
   if(path==='/backup'){
    if(req.method==='GET'){const backup=database.backups.find(b=>b.ownerId===user.id);reply(res,200,{backup:backup??null});return true;}
    if(req.method==='PUT'){const incoming=await bodyOf(req);if(!incoming.data||incoming.data.version!==1||!Array.isArray(incoming.data.records)||incoming.data.records.length>backupKeys.size)fail(400,'Invalid backup.');const seen=new Set();for(const record of incoming.data.records){if(!record||!backupKeys.has(record.key)||seen.has(record.key)||typeof record.value!=='string'||record.value.length>500000)fail(400,'Invalid backup record.');seen.add(record.key);}const backup=await transaction(db=>{const prior=db.backups.find(b=>b.ownerId===user.id);if((incoming.expectedRevision??0)!==(prior?.revision??0))fail(409,'Cloud backup changed. Review it before replacing it.');const next={ownerId:user.id,revision:(prior?.revision??0)+1,updatedAt:now(),data:incoming.data};db.backups=db.backups.filter(b=>b.ownerId!==user.id);db.backups.push(next);return next;});reply(res,200,{backup});return true;}
    if(req.method==='DELETE'){await transaction(db=>{db.backups=db.backups.filter(b=>b.ownerId!==user.id);});reply(res,200,{ok:true});return true;}
   }
   if(path==='/shares'&&req.method==='GET'){const shares=database.shares.filter(s=>s.ownerId===user.id||s.viewerIds.includes(user.id)&&!s.revokedAt&&s.expiresAt>now()).map(s=>viewShare(s,user));reply(res,200,{shares});return true;}
   if(path==='/shares'&&req.method==='POST'){const incoming=await bodyOf(req,4096);const share=await transaction(db=>{if(db.shares.filter(s=>s.ownerId===user.id&&!s.revokedAt&&s.expiresAt>now()).length>=5)fail(409,'End an existing session before creating another.');const result={id:randomUUID(),ownerId:user.id,label:cleanText(incoming.label)||'My walk',invite:token(),viewerIds:[],expiresAt:now()+Math.max(300000,Math.min(86400000,Number(incoming.durationMs)||3600000)),revokedAt:null,position:null,checkIns:[]};db.shares.push(result);return result;});reply(res,201,{share:viewShare(share,user)});return true;}
   if(path==='/shares/accept'&&req.method==='POST'){const incoming=await bodyOf(req,4096);const share=await transaction(db=>{const item=db.shares.find(s=>s.invite===incoming.invite&&!s.revokedAt&&s.expiresAt>now());if(!item)fail(404,'Invitation expired or is not available.');if(item.ownerId===user.id)fail(409,'Use another signed-in account to accept this invitation.');if(!item.viewerIds.includes(user.id))item.viewerIds.push(user.id);return item;});reply(res,200,{share:viewShare(share,user)});return true;}
   const shareMatch=path.match(/^\/shares\/([\w-]+)(?:\/(position|check-in|revoke|leave))?$/);
   if(shareMatch){const [,id,action]=shareMatch;
    const current=database.shares.find(s=>s.id===id);if(!current)fail(404,'Sharing session unavailable.');
    if(req.method==='GET'&&!action){reply(res,200,{share:viewShare(current,user)});return true;}
    if(req.method==='POST'&&action==='leave'){await transaction(db=>{const item=db.shares.find(s=>s.id===id);item.viewerIds=item.viewerIds.filter(value=>value!==user.id);});reply(res,200,{ok:true});return true;}
    if(current.ownerId!==user.id)fail(403,'Only the owner can change this sharing session.');
    if(req.method==='POST'&&action==='revoke'){await transaction(db=>{const item=db.shares.find(s=>s.id===id);item.revokedAt=now();item.position=null;item.checkIns=[];item.invite=null;});reply(res,200,{ok:true});return true;}
    if(current.revokedAt||current.expiresAt<=now())fail(410,'Sharing session has ended.');
    if(req.method==='POST'&&action==='position'){const p=await bodyOf(req,4096);if(!validPoint(p)||!Number.isFinite(p.accuracy)||p.accuracy<0||p.accuracy>10000||!Number.isFinite(p.observedAt)||Math.abs(now()-p.observedAt)>120000||!Number.isSafeInteger(p.sequence)||p.sequence<1)fail(400,'A recent location with accuracy is required.');const position=await transaction(db=>{const item=db.shares.find(s=>s.id===id);if(!item||item.revokedAt||item.expiresAt<=now())fail(410,'Sharing session has ended.');if(item.position&&p.sequence<=item.position.sequence)fail(409,'A newer position has already been received.');item.position={latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy,observedAt:p.observedAt,receivedAt:now(),sequence:p.sequence};return item.position;});reply(res,200,{position});return true;}
    if(req.method==='POST'&&action==='check-in'){const incoming=await bodyOf(req,4096);if(!cleanText(incoming.message,240))fail(400,'Enter a check-in message.');const event=await transaction(db=>{const item=db.shares.find(s=>s.id===id),eventId=cleanText(incoming.eventId,100)||randomUUID();if(!item||item.revokedAt||item.expiresAt<=now())fail(410,'Sharing session has ended.');const duplicate=item.checkIns.find(e=>e.id===eventId);if(duplicate)return duplicate;const result={id:eventId,message:cleanText(incoming.message,240),createdAt:now(),position:item.position};item.checkIns.push(result);item.checkIns=item.checkIns.slice(-100);return result;});reply(res,200,{event});return true;}
   }
   if(path==='/questions'&&req.method==='GET'){const answers=database.questions.filter(q=>q.ownerId===user.id&&q.status==='complete'&&q.answer).sort((a,b)=>b.startedAt-a.startedAt).slice(0,100).map(q=>({id:q.requestId,question:q.question??'Saved photo question',answer:q.answer,createdAt:q.completedAt??q.startedAt}));reply(res,200,{answers});return true;}
   if(path==='/questions'&&req.method==='POST'){
    if(!geminiKey)fail(503,'Photo questions are not configured. Your image has not been uploaded to an AI provider.');
    const incoming=await bodyOf(req,6000000),question=cleanText(incoming.question,2000),requestId=cleanText(incoming.requestId,100);
    if(!question||!requestId||!['image/jpeg','image/png','image/webp'].includes(incoming.mimeType)||typeof incoming.image!=='string'||incoming.image.length>5500000||!/^[A-Za-z0-9+/]+=*$/.test(incoming.image))fail(400,'Select a JPEG, PNG or WebP image under 4 MB and enter a question.');
    const requestHash=hash(JSON.stringify([incoming.image,incoming.mimeType,question])),month=monthOf(now());
    const reservation=await transaction(db=>{for(const q of db.questions)if(q.status==='pending'&&now()-q.startedAt>120000)q.status='failed';const previous=db.questions.find(q=>q.ownerId===user.id&&q.requestId===requestId);if(previous){if(previous.requestHash!==requestHash)fail(409,'This request identifier was already used for a different question.');if(previous.status==='complete'){if(!previous.answer)fail(410,'This answer was deleted. Submit a new question.');return previous;}if(previous.status==='pending')fail(409,'This question is still processing.');}if(db.questions.filter(q=>q.ownerId===user.id&&q.month===month&&q.status!=='failed').length>=photoLimit)fail(429,'Your monthly photo-question limit has been reached.');if(previous){previous.status='pending';previous.month=month;previous.error=null;previous.startedAt=now();return previous;}const result={ownerId:user.id,requestId,requestHash,question:cleanText(incoming.displayQuestion,1500)||question,month,status:'pending',startedAt:now(),answer:null};db.questions.push(result);return result;});
    if(reservation.status==='complete'){reply(res,200,{answer:reservation.answer,requestId,reused:true});return true;}
    try{const response=await upstream(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},signal:AbortSignal.timeout(45000),body:JSON.stringify({systemInstruction:{parts:[{text:'Describe images clearly for a blind user. State uncertainty. Never tell the user it is safe to cross a road or rely on an image for real-time traffic decisions. Do not infer identities or sensitive personal attributes.'}]},contents:[{parts:[{inlineData:{mimeType:incoming.mimeType,data:incoming.image}},{text:question}]}],generationConfig:{maxOutputTokens:1500}})});if(!response.ok)throw new Error('Provider unavailable');const result=await response.json();const answer=result.candidates?.[0]?.content?.parts?.map(p=>p.text??'').join('\n').trim();if(!answer)throw new Error('No answer');await transaction(db=>{const item=db.questions.find(q=>q.ownerId===user.id&&q.requestId===requestId);if(item){item.status='complete';item.answer=answer.slice(0,16000);item.completedAt=now();}});reply(res,200,{answer:answer.slice(0,16000),requestId,reused:false});}
    catch{await transaction(db=>{const item=db.questions.find(q=>q.ownerId===user.id&&q.requestId===requestId);if(item)item.status='failed';});fail(502,'The photo service could not answer. Retry this question; failed requests do not use the monthly limit.');}return true;
   }
   if(path==='/questions'&&req.method==='DELETE'){await transaction(db=>{for(const q of db.questions)if(q.ownerId===user.id)q.answer=null;});reply(res,200,{ok:true});return true;}
   fail(404,'Unknown product service.');
  }catch(error){if(!res.headersSent)reply(res,error instanceof ApiError?error.status:503,{error:error instanceof ApiError?error.message:'Product service is unavailable. Try again.'});else res.destroy();return true;}
 };
}
