import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BookmarkTagIndex } from '../src/shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotSettings
} from '../src/shared/content-snapshot-search.js'
import type { BookmarkRecord } from '../src/shared/types.js'
import {
  buildLightPopupSearchIndex,
  shouldWarmPopupSnapshotFullText
} from '../src/popup/search-index.js'

function bookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const title = overrides.title || 'Example'
  const url = overrides.url || 'https://example.com'
  return {
    id: overrides.id || title,
    title,
    url,
    displayUrl: overrides.displayUrl || url,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedUrl: overrides.normalizedUrl || url.replace(/^https?:\/\//, '').toLowerCase(),
    duplicateKey: overrides.duplicateKey || url,
    domain: overrides.domain || 'example.com',
    path: overrides.path || 'Bookmarks Bar',
    ancestorIds: overrides.ancestorIds || ['1'],
    parentId: overrides.parentId || '1',
    index: overrides.index || 0,
    dateAdded: overrides.dateAdded || 0
  }
}

const snapshotSettings: ContentSnapshotSettings = {
  version: 1,
  enabled: true,
  autoCaptureOnBookmarkCreate: true,
  saveFullText: true,
  fullTextSearchEnabled: true,
  localOnlyNoAiUpload: true
}

function snapshotIndex(): ContentSnapshotIndex {
  return {
    version: 1,
    updatedAt: 1,
    records: {
      docs: {
        snapshotId: 'snapshot-docs',
        bookmarkId: 'docs',
        url: 'https://example.com/docs',
        title: 'Docs',
        summary: 'React reference summary',
        headings: ['Quick start'],
        canonicalUrl: 'https://example.com/docs',
        finalUrl: 'https://example.com/docs',
        contentType: '文档',
        source: 'html',
        extractionStatus: 'ok',
        extractedAt: 1,
        hasFullText: true,
        fullTextBytes: 30000,
        fullTextStorage: 'idb',
        fullTextRef: 'snapshot-docs',
        warnings: []
      }
    }
  }
}

test('popup light search index keeps snapshot metadata but skips IDB full text at first paint', () => {
  const indexed = buildLightPopupSearchIndex({
    bookmarks: [bookmark({
      id: 'docs',
      title: 'React Docs',
      normalizedTitle: 'react docs',
      normalizedUrl: 'example.com/docs'
    })],
    tagIndex: null,
    snapshotIndex: snapshotIndex()
  })

  assert.equal(indexed.length, 1)
  assert.match(indexed[0].searchText, /react reference summary/)
  assert.match(indexed[0].searchText, /quick start/)
  assert.doesNotMatch(indexed[0].searchText, /hidden full text term/)
})

test('popup snapshot full text warmup only runs when settings allow searchable IDB text', () => {
  assert.equal(
    shouldWarmPopupSnapshotFullText({ settings: snapshotSettings, index: snapshotIndex() }),
    true
  )
  assert.equal(
    shouldWarmPopupSnapshotFullText({
      settings: { ...snapshotSettings, fullTextSearchEnabled: false },
      index: snapshotIndex()
    }),
    false
  )
  assert.equal(
    shouldWarmPopupSnapshotFullText({
      settings: snapshotSettings,
      index: { ...snapshotIndex(), records: {} }
    }),
    false
  )
})

test('popup snapshot full text warmup also covers local full text records', () => {
  const index = snapshotIndex()
  index.records.docs.fullTextStorage = 'local'
  index.records.docs.fullText = 'short local full text'
  index.records.docs.fullTextRef = undefined

  assert.equal(
    shouldWarmPopupSnapshotFullText({ settings: snapshotSettings, index }),
    true
  )
})

test('popup light search index still includes AI tag fields without snapshot full text', () => {
  const tagIndex: BookmarkTagIndex = {
    version: 1,
    updatedAt: 1,
    records: {
      docs: {
        schemaVersion: 1,
        bookmarkId: 'docs',
        url: 'https://example.com/docs',
        normalizedUrl: 'https://example.com/docs',
        duplicateKey: 'https://example.com/docs',
        title: 'React Docs',
        path: 'Frontend / React',
        summary: 'Official React learning material',
        contentType: '文档',
        topics: ['React'],
        tags: ['docs'],
        aliases: ['React 文档'],
        confidence: 0.9,
        source: 'ai_naming',
        model: 'test',
        extraction: { status: 'ok', source: 'html', warnings: [] },
        generatedAt: 1,
        updatedAt: 1
      }
    }
  }

  const indexed = buildLightPopupSearchIndex({
    bookmarks: [bookmark({
      id: 'docs',
      title: 'React Docs',
      normalizedTitle: 'react docs',
      normalizedUrl: 'example.com/docs'
    })],
    tagIndex,
    snapshotIndex: null
  })

  assert.match(indexed[0].searchText, /official react learning material/)
  assert.match(indexed[0].searchText, /react 文档/)
})
