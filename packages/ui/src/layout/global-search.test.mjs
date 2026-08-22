import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(
  path.resolve('packages/ui/src/layout/global-search.tsx'),
  'utf8',
);

test('global search renders an exact best-match section before category groups', () => {
  assert.match(source, /bestMatch\?: GlobalSearchResult/);
  assert.match(source, /Best match/);
  assert.ok(source.indexOf('Best match') < source.indexOf('searchGroups.map'));
  assert.match(source, /withoutBestMatch\(\s*searchResponse\.results\[group\.key\]/);
});

test('keyboard navigation uses the same displayed ranking as the popover', () => {
  assert.match(source, /export function getDisplayedGlobalSearchResults/);
  assert.match(source, /return response\.bestMatch \? \[response\.bestMatch, \.\.\.groupedResults\] : groupedResults/);
  assert.match(source, /return getDisplayedGlobalSearchResults\(searchResponse\)/);
  assert.match(source, /const selectedResult = flatResults\[activeIndex\]/);
});
