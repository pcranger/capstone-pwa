import {Store} from '../state/store';
export const speechStatus=new Store<{error:string|null;locale:string|null}>({error:null,locale:null});
