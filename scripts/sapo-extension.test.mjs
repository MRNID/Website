import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../extensions/sapo-sync-extension/connection.js', import.meta.url), 'utf8');
function fixture(sendMessage) {
  const injected = [];
  const context = { URL, chrome: {
    tabs: { sendMessage },
    scripting: {
      insertCSS: async input => injected.push(['css', input]),
      executeScript: async input => injected.push(['js', input])
    }
  } };
  runInNewContext(source, context);
  return { reader: context.sapoConnection, injected };
}
const tab = { id: 12, url: 'https://shanam.mysapogo.com/admin/shipments' };

test('Sapo reader already connected does not inject again', async () => {
  const { reader, injected } = fixture(async () => ({ ready: true }));
  await reader.ensureReader(tab);
  assert.equal(injected.length, 0);
});
test('missing reader is injected and pinged without submitting any orders', async () => {
  const messages = [];
  const { reader, injected } = fixture(async (_id, message) => {
    messages.push(message.action);
    if (messages.length === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
    return { ready: true };
  });
  await reader.ensureReader(tab);
  assert.deepEqual(messages, ['PACKING_PROOF_PING', 'PACKING_PROOF_PING']);
  assert.deepEqual(injected.map(([type]) => type), ['css', 'js']);
});
test('unrelated and lookalike sites are rejected before accessing the page', async () => {
  const { reader, injected } = fixture(async () => assert.fail('Unexpected message'));
  for (const url of ['https://mysapogo.com.evil.test', 'https://example.com', 'chrome://extensions']) {
    await assert.rejects(reader.ensureReader({ id: 12, url }), /Sapo/);
  }
  assert.equal(injected.length, 0);
});
test('closed message channel does not trigger injection or automatic sync retry', async () => {
  const { reader, injected } = fixture(async () => { throw new Error('The message port closed'); });
  await assert.rejects(reader.ensureReader(tab), /message port closed/);
  assert.equal(injected.length, 0);
});
test('older installed reader requests refresh instead of duplicate listeners', async () => {
  const { reader, injected } = fixture(async () => undefined);
  await assert.rejects(reader.ensureReader(tab), /phiên bản cũ/);
  assert.equal(injected.length, 0);
});
