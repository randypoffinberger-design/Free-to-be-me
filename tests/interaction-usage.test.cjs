const {test}=require('node:test');const assert=require('node:assert/strict');
const create=require('../interaction-usage.js');
test('visible idle time earns zero; input-bracketed gaps only, without event content',()=>{
 let clock=0,visible=true,online=true;const c=create({now:()=>clock,visible:()=>visible,online:()=>online});
 assert.equal(c.take(),null);assert.equal(c.take('home').activeSeconds,0);
 clock=60000;assert.equal(c.take(),null);
 c.interact({isTrusted:true,key:'PRIVATE',target:{value:'CHILD'}});clock+=4000;c.interact({isTrusted:true});
 assert.deepEqual(c.take(),{activeSeconds:4,activeFeature:'home'});
 clock+=60000;c.interact({isTrusted:true});assert.equal(c.take().activeSeconds,0);
 c.interact({isTrusted:false});assert.equal(c.take(),null);
 visible=false;clock+=5000;c.interact({isTrusted:true});assert.equal(c.take(),null);
 visible=true;online=false;c.interact({isTrusted:true});assert.equal(c.take(),null);
});
test('navigation attributes preceding time to old feature and resets input gap; identity reset drops pending time',()=>{
 let clock=0;const c=create({now:()=>clock,visible:()=>true,online:()=>true});
 c.take('home');c.interact({isTrusted:true});clock=2000;c.interact({isTrusted:true});
 assert.deepEqual(c.take('profile'),{activeSeconds:2,activeFeature:'home'});
 clock=3000;c.interact({isTrusted:true});clock=5000;c.interact({isTrusted:true});assert.deepEqual(c.take(),{activeSeconds:2,activeFeature:'profile'});
 clock=6000;c.interact({isTrusted:true});c.reset();assert.equal(c.take(),null);
});
test('suspended timers and clock rollback cannot produce unbounded credit',()=>{
 let clock=0;const c=create({now:()=>clock,visible:()=>true,online:()=>true});c.take('home');c.interact({isTrusted:true});
 for(let i=0;i<100;i++){clock+=1000;c.interact({isTrusted:true});}assert.equal(c.take().activeSeconds,60);
 clock=-100;c.interact({isTrusted:true});assert.equal(c.take().activeSeconds,0);
});
