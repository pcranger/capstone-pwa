import {describe,it,expect} from 'vitest';
import {OBJECT_TYPES,SUPPORTED_OBJECTS,defaultProductPreferences,validateProductPreferences,speechLevelFor} from '../../src/product/preferences';
describe('product settings',()=>{
 it('represents twenty types while enabling only baseline-supported categories',()=>{const p=defaultProductPreferences();expect(OBJECT_TYPES).toHaveLength(20);expect(Object.values(p.objects).filter(Boolean)).toHaveLength(4);expect(SUPPORTED_OBJECTS.has('pedestrian_green')).toBe(false);});
 it('rejects malformed enums and cannot enable unsupported types through imported data',()=>{const p=validateProductPreferences({version:1,objectRange:'meters',textSize:'huge',objects:{person:false,pedestrian_green:true}});expect(p.objectRange).toBe('front');expect(p.textSize).toBe('system');expect(p.objects.person).toBe(false);expect(p.objects.pedestrian_green).toBe(false);});
 it('maps the previous relative rate to a nearest displayed level',()=>{expect(speechLevelFor(.85)).toBe(55);expect(speechLevelFor(1.5)).toBe(80);});
});
