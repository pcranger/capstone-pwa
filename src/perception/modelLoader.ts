export interface ModelSource {kind:'asset'|'file';name:string;uri?:string;}
export const BUNDLED_MODEL='coco-ssd';
export function referenceOf(source:ModelSource){return `${source.kind}:${source.name}`;}
export function displayNameOf(source:ModelSource){return source.name;}
