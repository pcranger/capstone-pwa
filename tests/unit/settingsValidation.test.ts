import {expect,it} from 'vitest';
import {DEFAULT_SETTINGS,validateAppSettings} from '../../src/settings/settings';
it('restores partial legacy settings and rejects malformed types, invalid enum and unsafe numeric bounds',()=>{
 const settings=validateAppSettings({speech:false,tones:'true',speechRate:Infinity,scoreThreshold:-1,verbosity:'unknown',interfaceMode:'ADMIN',appFont:'missing',customModelPath:{path:'other'}});
 expect(settings.speech).toBe(false);expect(settings.tones).toBe(DEFAULT_SETTINGS.tones);
 expect(settings.speechRate).toBe(DEFAULT_SETTINGS.speechRate);expect(settings.scoreThreshold).toBe(DEFAULT_SETTINGS.scoreThreshold);
 expect(settings.verbosity).toBe(DEFAULT_SETTINGS.verbosity);expect(settings.interfaceMode).toBe(DEFAULT_SETTINGS.interfaceMode);expect(settings.customModelPath).toBeNull();
 expect(validateAppSettings({speechRate:1.8,scoreThreshold:.6}).speechRate).toBe(1.8);
});
