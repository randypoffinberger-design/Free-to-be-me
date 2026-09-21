const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('analytics iframe navigation cannot overwrite the cached offline app',async()=>{
  const handlers={},matches=[];let response;
  const self={location:{origin:'https://randypoffinberger-design.github.io',href:'https://randypoffinberger-design.github.io/Free-to-be-me/service-worker.js'},addEventListener:(name,fn)=>handlers[name]=fn};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../service-worker.js','utf8'),{self,URL,caches:{match:async key=>{matches.push(key);return 'analytics-document';},open:()=>{throw Error('must not open shell cache');}},fetch:()=>{throw Error('already cached');}});
  handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://randypoffinberger-design.github.io/Free-to-be-me/analytics-frame.html'},respondWith:p=>response=p});
  assert.equal(await response,'analytics-document');assert.deepEqual(matches,['./analytics-frame.html']);
});
