const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '..', 'demo-assets');

test('demo evidence files are synthetic valid PNG illustrations and a playable WAV alert', () => {
  for (const name of ['demo-second-payment-request.png', 'demo-payment-chat.png']) {
    const image = fs.readFileSync(path.join(assets, name));
    assert.ok(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  }
  const audio = fs.readFileSync(path.join(assets, 'demo-fraud-alert.wav'));
  assert.equal(audio.subarray(0, 4).toString(), 'RIFF');
  assert.equal(audio.subarray(8, 12).toString(), 'WAVE');
  assert.ok(audio.length > 40_000, 'audio sample should contain audible sample data');
});
