export const SECTION_META = {
  overview: {
    label: 'Overview',
    title: '概览'
  },
  general: {
    label: 'General',
    title: '通用设置'
  },
  dashboard: {
    label: 'Dashboard',
    title: '书签仪表盘'
  },
  availability: {
    label: 'Availability',
    title: '书签可用性检测'
  },
  history: {
    label: 'History',
    title: '检测历史'
  },
  'bookmark-history': {
    label: 'Auto Analysis Add History',
    title: '自动分析添加历史'
  },
  ai: {
    label: 'Smart Bookmark Analysis',
    title: '书签智能分析'
  },
  backup: {
    label: 'Data & Backup',
    title: '数据与备份'
  },
  tags: {
    label: 'Tag Management',
    title: '标签管理中心'
  },
  redirects: {
    label: 'Redirects',
    title: '重定向更新'
  },
  duplicates: {
    label: 'Duplicates',
    title: '重复书签'
  },
  'folder-cleanup': {
    label: '文件夹清理',
    title: '文件夹清理'
  },
  ignore: {
    label: 'Ignore Rules',
    title: '忽略规则 / 白名单'
  },
  recycle: {
    label: 'Recycle Bin',
    title: '回收站'
  }
} as const

export const HISTORY_LOG_LIMIT = 12
export const NAVIGATION_TIMEOUT_MS = 30000
export const NAVIGATION_RETRY_TIMEOUT_MS = 45000
export const AVAILABILITY_CONCURRENCY = 2
export const AI_NAMING_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
export const AI_NAMING_DEFAULT_MODEL = 'gpt-5.5'
export const AI_NAMING_DEFAULT_TIMEOUT_MS = 30000
export const AI_NAMING_DEFAULT_BATCH_SIZE = 6
export const AI_NAMING_MAX_BATCH_SIZE = 20
export const AI_NAMING_MAX_TEXT_LENGTH = 80
export const AI_NAMING_MANAGE_MODELS_VALUE = '__manage_custom_models__'
export const AI_NAMING_MODELS_ENDPOINT_SUFFIX = 'models'
export const AI_NAMING_FETCHED_MODELS_LIMIT = 200
export const AI_NAMING_JINA_READER_ORIGIN = 'https://r.jina.ai/*'
export const AI_NAMING_PRESET_MODELS = [
  'gpt-5.5',
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano'
]
export const AI_NAMING_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'bookmark_id',
          'summary',
          'content_type',
          'topics',
          'suggested_title',
          'suggested_folder',
          'tags',
          'aliases',
          'action',
          'confidence',
          'reason'
        ],
        properties: {
          bookmark_id: {
            type: 'string'
          },
          summary: {
            type: 'string',
            maxLength: 500
          },
          content_type: {
            type: 'string',
            maxLength: 40
          },
          topics: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'string',
              maxLength: 40
            }
          },
          action: {
            type: 'string',
            enum: ['rename', 'keep', 'manual_review']
          },
          suggested_title: {
            type: 'string',
            maxLength: AI_NAMING_MAX_TEXT_LENGTH
          },
          suggested_folder: {
            type: 'string',
            maxLength: 180
          },
          tags: {
            type: 'array',
            maxItems: 12,
            items: {
              type: 'string',
              maxLength: 24
            }
          },
          aliases: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'string',
              maxLength: 40
            }
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          reason: {
            type: 'string'
          }
        }
      }
    }
  }
} as const
