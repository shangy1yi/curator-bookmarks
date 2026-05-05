import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildSpeedDialItems,
  createSpeedDialEmptyState,
  getSpeedDialPinActionCopy,
  isSpeedDialBookmarkPinned
} from '../src/newtab/speed-dial.js'

test('builds speed dial items from pinned ids without changing their order', () => {
  const items = buildSpeedDialItems({
    pinnedIds: ['3', 'missing', '1', '3', '2'],
    bookmarks: [
      { id: '1', title: 'React Docs', url: 'https://react.dev/learn' },
      { id: '2', title: 'No Url', url: '' },
      { id: '3', title: 'GitHub', url: 'https://github.com/sy0u1ti/curator' }
    ]
  })

  assert.deepEqual(items.map((item) => item.id), ['3', '1'])
  assert.deepEqual(items.map((item) => item.domain), ['github.com', 'react.dev'])
  assert.equal(items[0].fallbackLabel, 'G')
})

test('limits speed dial output and supports bookmark maps', () => {
  const bookmarks = new Map([
    ['a', { id: 'a', title: 'Alpha', url: 'https://a.test/' }],
    ['b', { id: 'b', title: 'Beta', url: 'https://b.test/' }]
  ])

  assert.deepEqual(
    buildSpeedDialItems({ pinnedIds: ['a', 'b'], bookmarks, limit: 1 }).map((item) => item.id),
    ['a']
  )
})

test('returns clear empty state and pin action copy', () => {
  assert.doesNotMatch(createSpeedDialEmptyState('工作').detail, /搜索书签|右键固定|管理场景/)
  assert.equal(getSpeedDialPinActionCopy(false, '工作').label, '固定到工作')
  assert.equal(getSpeedDialPinActionCopy(true, '工作').status, '已从工作取消固定')
  assert.equal(isSpeedDialBookmarkPinned(['1', '2'], '2'), true)
  assert.equal(isSpeedDialBookmarkPinned(['1', '2'], '3'), false)
})
