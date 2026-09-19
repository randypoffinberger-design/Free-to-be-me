const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('test website worker leaves sibling API and SK requests outside its cache',()=>{
  const handlers={};
  const self={location:new URL('https://private.example/mtm-test/service-worker.js'),addEventListener:(name,fn)=>handlers[name]=fn};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8'),{self,URL,caches:{match:()=>Promise.resolve(new Response('cached'))}});
  for(const url of ['https://private.example/mtm-test-api/v1/account','https://private.example/sk-test/','https://other.example/mtm-test/app.js']){
    let intercepted=false;handlers.fetch({request:{url,method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  }
  let intercepted=false;handlers.fetch({request:{url:'https://private.example/mtm-test/app.js',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,true);
});
