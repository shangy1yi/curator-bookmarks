export const PERMISSION_DISCLOSURES = [
  {
    name: 'bookmarks',
    copy: '读取和整理 Chrome 书签树，用于搜索、移动、去重、回收站和备份。'
  },
  {
    name: 'storage',
    copy: '保存设置、标签、摘要、忽略规则、检测历史和新标签页配置；默认保存在本地扩展数据中。'
  },
  {
    name: 'activeTab',
    copy: '用户主动点击扩展或使用快捷键时读取当前页标题和 URL，用于保存或智能分类当前页面。'
  },
  {
    name: 'webNavigation / webRequest / host permissions',
    copy: '仅在用户运行可用性检测、重定向检查或网页内容抽取时访问目标链接，用来判断页面是否可打开。'
  },
  {
    name: 'alarms / notifications',
    copy: '驱动自动分析队列和完成提醒，不用于后台追踪浏览行为。'
  },
  {
    name: 'favicon',
    copy: '显示书签网站图标，让管理列表更容易识别。'
  }
] as const
