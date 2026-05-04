import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import {
  getIgnoreRuleActionLabel,
  matchesIgnoreRules,
  normalizeIgnoreRules,
  serializeIgnoreRules
} from '../src/options/sections/ignore.js'
import { managerState } from '../src/options/shared-options/state.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('normalizes and serializes ignore rules', () => {
  const rules = normalizeIgnoreRules({
    bookmarks: [{ bookmarkId: 123, title: '', url: 'https://example.com', createdAt: 1 }],
    domains: [{ domain: 'Example.COM', createdAt: 2 }],
    folders: [{ folderId: 10, title: '', path: 'Root / Folder', createdAt: 3 }]
  })

  assert.deepEqual(serializeIgnoreRules(rules), {
    bookmarks: [{ bookmarkId: '123', title: '未命名书签', url: 'https://example.com', createdAt: 1 }],
    domains: [{ domain: 'example.com', createdAt: 2 }],
    folders: [{ folderId: '10', title: '未命名文件夹', path: 'Root / Folder', createdAt: 3 }]
  })
})

test('matches ignore rules by bookmark, domain or ancestor folder', () => {
  managerState.ignoreRules = normalizeIgnoreRules({
    bookmarks: [{ bookmarkId: 'bookmark-1', title: 'One', url: '', createdAt: 1 }],
    domains: [{ domain: 'example.com', createdAt: 2 }],
    folders: [{ folderId: 'folder-1', title: 'Folder', path: '', createdAt: 3 }]
  })

  assert.equal(matchesIgnoreRules({ id: 'bookmark-1' }), true)
  assert.equal(matchesIgnoreRules({ id: 'bookmark-2', domain: 'example.com' }), true)
  assert.equal(matchesIgnoreRules({ id: 'bookmark-3', ancestorIds: ['folder-1'] }), true)
  assert.equal(matchesIgnoreRules({ id: 'bookmark-4', domain: 'other.example', ancestorIds: [] }), false)
})

test('ignore rule action labels include rule context', () => {
  const bookmarkLabel = getIgnoreRuleActionLabel(
    '删除忽略规则',
    { title: 'OpenAI Docs', url: 'https://example.com/docs' },
    'bookmark'
  )
  const folderLabel = getIgnoreRuleActionLabel(
    '删除忽略规则',
    { title: 'Docs', path: '书签栏 / AI / Docs' },
    'folder'
  )
  const domainLabel = getIgnoreRuleActionLabel(
    '删除忽略规则',
    { domain: 'example.com' },
    'domain'
  )
  const longLabel = getIgnoreRuleActionLabel(
    '删除忽略规则',
    { title: '很长的忽略规则名称'.repeat(8) },
    'bookmark'
  )

  assert.equal(bookmarkLabel, '删除忽略规则：OpenAI Docs')
  assert.equal(folderLabel, '删除忽略规则：书签栏 / AI / Docs')
  assert.equal(domainLabel, '删除忽略规则：example.com')
  assert.match(longLabel, /…$/)
})

test('ignore rule remove buttons render rule-specific labels', () => {
  const source = readProjectFile('src/options/sections/ignore.ts')

  assert.match(source, /const deleteLabel = getIgnoreRuleActionLabel\('删除忽略规则', rule, kind\)/)
  assert.match(source, /data-ignore-remove="\$\{escapeAttr\(kind\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(deleteLabel\)\}"/)
})

test('ignore rule clear category buttons expose category-specific labels', () => {
  const html = readProjectFile('src/options/options.html')

  assert.match(html, /id="ignore-clear-bookmarks"[^>]+aria-label="清空按书签忽略规则"/)
  assert.match(html, /id="ignore-clear-domains"[^>]+aria-label="清空按域名忽略规则"/)
  assert.match(html, /id="ignore-clear-folders"[^>]+aria-label="清空按文件夹忽略规则"/)
})
