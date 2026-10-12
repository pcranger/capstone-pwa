export interface SpeechInput {prepare():Promise<void>;listen(onReady:()=>void):Promise<string>;cancel():void;}
