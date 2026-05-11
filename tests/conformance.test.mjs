import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('platform agnostic guards',()=>{const text=fs.readFileSync('README.md','utf8');assert.match(text,/platform-agnostic trust protocol/i);});
test('profiles exist',()=>['profiles/a2a-trust-profile.md','profiles/mcp-trust-profile.md','profiles/scim-re-authority-profile.md','profiles/rap-decision-profile.md'].forEach(p=>assert.ok(fs.existsSync(p))));
