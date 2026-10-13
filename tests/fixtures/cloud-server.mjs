import {createApp} from '../../server.mjs';
const configured=process.argv[2]!=='unconfigured';
const app=createApp({advancedOptions:{dataDir:configured?process.argv[2]:'',geminiKey:configured?'e2e-fixture-only-key':'',geminiModel:'fixture-image-model',secureCookies:false,upstream:async()=>Response.json({candidates:[{content:{parts:[{text:'The image shows a library entrance sign. The image alone cannot establish a safe walking path.'}]}}]})}});
app.listen(0,'127.0.0.1',()=>console.log(`READY http://127.0.0.1:${app.address().port}`));
process.on('SIGTERM',()=>app.close(()=>process.exit(0)));
