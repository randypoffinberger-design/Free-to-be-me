const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function moduleWindow(name) { const window = {}; vm.runInNewContext(read(name), {window}); return window; }

test('library preserves existing order with Halloween inserted second', () => {
  const html = moduleWindow('library-books.js').MTMBookLibrary.render();
  const titles = [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(titles.slice(0, 3), ["Being Different Doesn&#39;t Mean Less", 'Halloween Is For Everyone', 'Poppy&#39;s First Time At The Beach']);
  assert.equal(titles.length, 8);
  assert.equal(new Set(titles).size, 8);
});

test('play finder intersects interest and access filters without duplicate providers', () => {
  const play = moduleWindow('sensory-play.js').MTMSensoryPlay;
  const names = filters => Array.from(play.matching(filters), r => r.name);
  assert.equal(new Set(names()).size, 5);
  assert.deepEqual(names({access:'Switch'}), ['Maggie Games','Adaptatech']);
  assert.deepEqual(names({need:'Matching / sorting',access:'Switch'}), ['Maggie Games']);
  assert.deepEqual(names({query:'  RIPPlES  '}), ['Maggie Games']);
  assert.deepEqual(names({need:'Printables',access:'Eye gaze'}), []);
  const html = play.render();
  for (const name of names()) assert.equal((html.match(new RegExp(`<summary>${name}</summary>`, 'g')) || []).length, 1);
  assert.ok(html.includes('https://maggiegames.com/printables/'));
});

test('new products appear once in their requested catalog categories', () => {
  const source = read('app.js');
  const catalog = source.slice(source.indexOf('const OTHER_PRODUCT_CATALOG='),source.indexOf('const PRODUCT_DIRECTORY_SECTIONS='));
  const products = vm.runInNewContext(catalog + ';OTHER_PRODUCT_CATALOG');
  for (const [category, url] of [['skill','https://easytot.com/products/brain-training-overnight-sensory-underwear-for-bedwetting'],['sleep','https://hugsleep.com/products/sleep-pod-junior']]) {
    const entries = products.filter(p => p[2] === url);
    assert.equal(entries.length, 1);
    assert.ok(entries[0][0].split(' ').includes(category));
  }
});
