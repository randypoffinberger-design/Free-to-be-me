const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function fixture(){
  const elements={};
  const context={esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),wordKey:s=>String(s).trim().toLowerCase(),$:id=>elements[id]||(elements[id]={}),modal:{open:false,showModal(){this.open=true;}},modalBody:{},view:{}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const AMAZON_PRODUCT_CATALOG='),source.indexOf('async function openLearningSnapshot'))+';this.catalog=PRODUCT_CATALOG;this.groups=SENSORY_PRODUCT_GROUPS;',context);
  return {context,elements};
}
test('every sensory product has exactly one dropdown and retains other section tags',()=>{
  const {context:c}=fixture();
  const sensory=c.catalog.filter(p=>p[0].split(' ').includes('sensory'));
  assert.equal(sensory.length,78);
  for(const [categories,name] of sensory){
    assert.equal(c.groups.filter(([id])=>categories.split(' ').includes(id)).length,1,name);
  }
  assert.ok(sensory.find(p=>p[1]==='Comfrt Dreamer Blanket')[0].split(' ').includes('sleep'));
  assert.equal(c.catalog.filter(p=>p[2]==='https://a.co/d/06P4pNf3').length,1);
  assert.equal(c.catalog.filter(p=>p[2].includes('/dp/B0GJ3DH3P5')).length,0,'existing monkey bars are retained instead of added twice');
  assert.equal(new Set(sensory.map(p=>p[2])).size,sensory.length);
});
test('sensory modal searches into collapsed dropdowns and opens only matching groups',()=>{
  const {context:c,elements:e}=fixture();
  c.openAmazonProductCatalog('sensory','Sensory products');
  assert.match(e['#amazonProductList'].innerHTML,/Swings &amp; Suspended Equipment/);
  assert.doesNotMatch(e['#amazonProductList'].innerHTML,/<details class="education-card" open>/);
  e['#amazonProductSearch'].oninput({target:{value:'therapy putty'}});
  assert.equal(e['#amazonProductCount'].textContent,'Showing 1 of 78 products.');
  assert.match(e['#amazonProductList'].innerHTML,/<details class="education-card" open>/);
  assert.match(e['#amazonProductList'].innerHTML,/Tactile Exploration/);
  assert.doesNotMatch(e['#amazonProductList'].innerHTML,/Swings &amp;/);
  e['#amazonProductSearch'].oninput({target:{value:'not-a-real-product'}});
  assert.match(e['#amazonProductList'].innerHTML,/No products match/);
});
test('directory groups sensory products while other catalogs remain flat and searchable',()=>{
  const {context:c,elements:e}=fixture();
  c.renderProductDirectory();
  assert.match(e['#productDirectorySections'].innerHTML,/sensory-product-groups/);
  e['#productDirectorySearch'].oninput({target:{value:'Trekassy'}});
  assert.match(e['#productDirectorySections'].innerHTML,/Swings &amp; Suspended Equipment \(3\)/);
  assert.equal((e['#productDirectorySections'].innerHTML.match(/<a class="education-link"/g)||[]).length,3);
  e['#productDirectorySearch'].oninput({target:{value:'Proloquo2Go'}});
  assert.match(e['#productDirectorySections'].innerHTML,/Speech &amp; Communication/);
  assert.doesNotMatch(e['#productDirectorySections'].innerHTML,/sensory-product-groups/);
});
