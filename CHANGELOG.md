# Changelog

## Unreleased

### Added

- 上传功能支持选择目标书库：管理员可在首页上传区域选择目标书库，文件直接写入该书库的 rootPath
- `POST /api/upload` 新增可选参数 `libraryId`，传入时上传到对应书库，不传时兼容旧 `comicsDir` / `novelsDir` 逻辑
- 上传文件类型按书库类型自动校验（comic 书库只允许归档、novel 书库只允许电子书、mixed 允许全部）
- 系统诊断和 PDF renderer 接口（`/api/system/*`）添加认证要求
- Library.defaultAccess 防御性数据库迁移（migration 25），兼容中间版本升级的老数据库

- 多用户书库权限能力（Library / UserLibraryAccess / UserGroup / GroupLibraryAccess）
- `UserCanViewLibrary()` 统一授权语义：admin→enabled / public→自动 / 直接授权 / 用户组继承
- `UserCanViewComic()` 处理 NULL libraryId 和不存在书库的向后兼容
- `checkComicAccess()` 被所有资源接口共用的权限校验中间件
- `GetReadingSessionComicID()` 用于阅读会话权限前置校验
- `ForbiddenPage` 前端无权限友好页面组件
- `FolderBrowser` 从 SiteSettingsPanel 抽取为公共目录选择组件
- `calculateReadingProgress()` / `isReadingFinished()` 集中进度计算工具函数
- 书库管理面板支持 `defaultAccess`（公开/私有）、`scanEnabled`（自动扫描开关）、目录浏览选择
- 站点设置中"目录配置已迁移到书库管理"引导卡片
- 管理员 API：`/api/admin/libraries` CRUD + `/api/admin/users/:id/library-access`

### Changed

- 站点目录配置入口迁移到书库管理，原入口改为引导提示
- OPDS All / Recent / Favorites / Search 全部接入 `opdsLibraryFilter()` 书库权限过滤
- OPDS `opdsLibraryFilter()` 对无用户/无权限返回 `WHERE 1 = 0`，不再放行全库
- 漫画详情、阅读器、小说页面接入 403 ForbiddenPage 友好展示
- 漫画列表按用户可访问书库过滤（`GetUserAccessibleLibraryIDs`）
- 阅读进度计算统一为 0-based index 的展示语义
- 系统诊断面板适配日间模式（33 处硬编码颜色替换为 CSS 变量）

### Fixed

- FolderBrowser 目录浏览器 API 路径错误（`/api/admin/browse` → `/api/browse-dirs`），导致书库管理中目录选择不可用
- AI 语义搜索未做书库权限过滤，普通用户可搜索到无权限书库内容
- `.gitignore` 缺少 `site-config.json` 和 `storage-history.json` 规则

- 普通用户可通过直接请求 comicId 越权访问漫画详情的问题
- OPDS 列表接口未过滤无权限书库、下载接口可下载无权限文件的问题
- `UserCanViewLibrary()` 缺少 `defaultAccess=public` 和用户组继承检查
- 收藏、评分、阅读进度、阅读状态、阅读会话、AI 推荐原因缺少权限校验的问题
- `UserCanViewComic()` 对 NULL libraryId 和不存在书库返回异常的问题
- 最后一页/最后章节显示 99% 的问题（漫画详情、漫画阅读器、小说阅读页、小说底栏）
- 系统诊断面板日间模式文字不可读的问题
- `frontend/tsconfig.tsbuildinfo` 被 Git 跟踪导致构建后误报"有未推送改动"
- 前端收藏/评分/阅读状态 403 错误被静默吞掉的问题

### Tests

- 新增 `internal/store/library_access_test.go`，覆盖 8 个回归场景：
  - admin 可访问所有 enabled 书库
  - 普通用户可访问 public 书库
  - 普通用户不可访问 disabled 书库
  - 直接授权可访问
  - 用户组授权可访问
  - 未授权 private 不可访问
  - NULL libraryId 兼容
  - 不存在书库兼容
- P7 集成验收：后端 build + 权限测试 + handler 测试 + 前端 lint/build 均通过

### Chore

- 停止跟踪 TypeScript 构建缓存文件 `frontend/tsconfig.tsbuildinfo`（已从 Git 索引移除）

### Known Issues

- `internal/store/db_test.go` 的 `TestComicCRUD` 存在历史 FTS5 搜索结果数量问题（返回 3 条而非 1 条），不是本轮改动引入

---

## 关键 Commit 列表（本轮 P0-P9）

| Commit | 描述 |
|:---|:---|
| `48e207a` | feat(frontend): 书库管理面板支持扫描状态展示和手动扫描 |
| `92fd8d8` | feat: 新增单书库扫描接口，扫描器支持按书库独立扫描 |
| `42f10de` | feat(store): 书库CRUD读写扫描状态字段，新增单书库漫画查询 |
| `46e084d` | feat(store): 书库表新增扫描状态字段，支持单书库扫描管理 |
| `5a179bc` | feat: 扫描器自动创建书库并写入libraryId/relativePath |
| `1061b4c` | fix(store,handler): 修复书库权限语义并为漫画详情加入访问校验 |
| `ed86220` | fix(handler): 修复 OPDS 下载接口权限校验并保留书库过滤入口 |
| `e77f657` | fix(handler): 修复 OPDS 列表接口书库权限漏洞 |
| `7855b61` | fix(auth): 统计、用户操作、阅读会话、AI 推荐等接口权限补漏 |
| `5ef2a65` | test(auth): 新增权限回归测试覆盖 |
| `e18b0f1` | fix(ui): 前端 403 无权限友好页面 + 403 错误透传 |
| `30a9d23` | refactor(settings): 站点目录配置入口迁移到书库管理 |
| `f75ce7c` | fix(ui): 修复日间模式下系统诊断面板样式问题 |
| `66fa6be` | fix(ui): 修复阅读进度显示 99% 问题，统一使用 calculateReadingProgress |
| `789ed5a` | chore(git): 停止跟踪 TypeScript 构建缓存文件 |
| `4b3b28d` | fix(ui): 统一小说阅读页及阅读器进度计算，消除最后章节 99% 问题 |
