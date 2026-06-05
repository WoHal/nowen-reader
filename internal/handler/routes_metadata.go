package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/nowen-reader/nowen-reader/internal/middleware"
)

func registerMetadataRoutes(api *gin.RouterGroup) {
	// Phase 4: Metadata, AI, OPDS, WebDAV, Recommendations, etc.
	// ============================================================

	// Metadata scraping — requires admin + scraper enabled
	meta := NewMetadataHandler()
	metadataGroup := api.Group("/metadata")
	metadataGroup.Use(middleware.AdminRequired(), middleware.ScraperRequired())
	{
		metadataGroup.GET("/search", meta.Search)
		metadataGroup.POST("/search", meta.Search)
		metadataGroup.POST("/apply", meta.Apply)
		metadataGroup.POST("/scan", meta.Scan)
		metadataGroup.POST("/novel-scan", meta.NovelScan)
		metadataGroup.POST("/batch", meta.Batch)
		metadataGroup.POST("/translate-batch", meta.TranslateBatch)
		metadataGroup.GET("/stats", meta.Stats)
		metadataGroup.POST("/ai-batch", meta.AIBatch)
		metadataGroup.GET("/library", meta.Library)
		metadataGroup.POST("/batch-selected", meta.BatchSelected)
		metadataGroup.POST("/clear", meta.ClearMetadata)
		metadataGroup.POST("/batch-rename", meta.BatchRename)
		metadataGroup.POST("/ai-rename", meta.AIRename)
		metadataGroup.POST("/ai-chat", meta.AIChat)
		metadataGroup.GET("/folder-tree", meta.FolderTree)
		metadataGroup.POST("/batch-folder", meta.BatchFolder)
	}

	// AI services
	ai := NewAIHandler()

	// AI 状态查询（所有登录用户可查看）
	aiStatus := api.Group("/ai")
	aiStatus.Use(middleware.AuthRequired())
	{
		aiStatus.GET("/status", ai.Status)
		aiStatus.GET("/usage", ai.GetUsageStats)
	}

	// AI 配置管理（仅管理员）
	aiAdmin := api.Group("/ai")
	aiAdmin.Use(middleware.AdminRequired())
	{
		aiAdmin.GET("/settings", ai.GetSettings)
		aiAdmin.PUT("/settings", ai.UpdateSettings)
		aiAdmin.GET("/models", ai.Models)
		aiAdmin.DELETE("/usage", ai.ResetUsageStats)
		aiAdmin.POST("/test", ai.TestConnection)
		// AI prompt templates (Phase 2) — 管理员管理
		aiAdmin.GET("/prompts", ai.GetPromptTemplates)
		aiAdmin.PUT("/prompts", ai.UpdatePromptTemplates)
		aiAdmin.DELETE("/prompts", ai.ResetPromptTemplates)
	}

	// AI 使用功能（需要 AI 权限）
	aiUse := api.Group("/ai")
	aiUse.Use(middleware.AIRequired())
	{
		// AI Chat (Phase 3)
		aiUse.POST("/chat", ai.Chat)
		// AI semantic search (Phase 4)
		aiUse.POST("/semantic-search", ai.SemanticSearch)
		// AI reading insight (Phase 5)
		aiUse.POST("/reading-insight", ai.GenerateReadingInsight)
		// AI batch suggest tags (Phase 5)
		aiUse.POST("/batch-suggest-tags", ai.BatchSuggestTags)
		// AI enhanced group detection (Phase 6)
		aiUse.POST("/enhance-group-detect", ai.EnhanceGroupDetect)
		// AI suggest category (Phase 6)
		aiUse.POST("/suggest-category", ai.SuggestCategory)
		// AI batch suggest category (Phase 6)
		aiUse.POST("/batch-suggest-category", ai.BatchSuggestCategory)
		// AI verify duplicates (Phase 7)
		aiUse.POST("/verify-duplicates", ai.VerifyDuplicates)
		// AI recommend goal (Phase 7)
		aiUse.POST("/recommend-goal", ai.RecommendGoal)
	}

	// AI per-comic features (Phase 1) — 需要 AI 权限
	comicByIDAI := api.Group("/comics/:id")
	comicByIDAI.Use(middleware.AIRequired())
	{
		comicByIDAI.POST("/ai-summary", ai.GenerateSummary)
		comicByIDAI.POST("/ai-parse-filename", ai.ParseFilename)
		// 目录级智能标题推断（结合父目录名 + 同伴文件名样本）
		comicByIDAI.POST("/ai-infer-title", ai.InferTitle)
		comicByIDAI.POST("/ai-suggest-tags", ai.SuggestTags)
		// Phase 2
		comicByIDAI.POST("/ai-analyze-cover", ai.AnalyzeCover)
		// Phase 6
		comicByIDAI.POST("/ai-complete-metadata", ai.CompleteMetadata)
		// Phase 7
		comicByIDAI.POST("/ai-chapter-recap", ai.ChapterRecap)
		// AI chapter summary (Phase 3)
		comicByIDAI.POST("/ai-chapter-summary", ai.ChapterSummary)
		comicByIDAI.POST("/ai-chapter-summaries", ai.BatchChapterSummaries)
		// AI page translation (Phase 4)
		comicByIDAI.POST("/ai-translate-page", ai.TranslatePage)
	}

	// OPDS protocol
	opds := NewOPDSHandler()
	opdsGroup := api.Group("/opds")
	{
		opdsGroup.GET("", opds.Root)
		opdsGroup.GET("/all", opds.All)
		opdsGroup.GET("/recent", opds.Recent)
		opdsGroup.GET("/favorites", opds.Favorites)
		opdsGroup.GET("/search", opds.Search)
		opdsGroup.GET("/download/:id", opds.Download)
	}

	// Recommendations
	rec := NewRecommendationHandler()
	api.GET("/recommendations", rec.GetRecommendations)
	api.GET("/recommendations/similar/:id", rec.GetSimilar)

	// AI recommendation reasons (需要 AI 权限)
	aiRecGroup := api.Group("")
	aiRecGroup.Use(middleware.AIRequired())
	{
		aiRecGroup.POST("/recommendations/ai-reasons", ai.GenerateRecommendationReasons)
	}

	// Tag translation — requires admin
	tagTranslate := NewTagTranslateHandler()
	tagTranslateAdmin := api.Group("")
	tagTranslateAdmin.Use(middleware.AdminRequired())
	{
		tagTranslateAdmin.POST("/tags/translate", tagTranslate.TranslateTags)
	}


	// ============================================================
	// 翻译引擎管理 API
	// ============================================================
	api.GET("/translate/engines", tagTranslate.GetEngines)
	api.GET("/translate/config", tagTranslate.GetTranslateConfig)
	api.GET("/translate/health", tagTranslate.GetEngineHealth)
	api.GET("/translate/cache/stats", tagTranslate.GetCacheStats)

	translateWrite := api.Group("/translate")
	translateWrite.Use(middleware.AdminRequired())
	{
		translateWrite.PUT("/config", tagTranslate.UpdateTranslateConfig)
		translateWrite.DELETE("/cache", tagTranslate.ClearCache)
		translateWrite.POST("/test", tagTranslate.TestEngine)
	}

	// ============================================================
	// Comic Groups (自定义合并分组)
	// ============================================================
	group := NewGroupHandler()
	api.GET("/groups", group.ListGroups)
	api.GET("/groups/comic-map", group.GetComicMap)
	api.GET("/groups/:id", group.GetGroup)

	groupWrite := api.Group("/groups")
	groupWrite.Use(middleware.AdminRequired())
	{
		groupWrite.POST("", group.CreateGroup)
		groupWrite.PUT("/:id", group.UpdateGroup)
		groupWrite.DELETE("/:id", group.DeleteGroup)
		groupWrite.POST("/:id/comics", group.AddComics)
		groupWrite.DELETE("/:id/comics/:comicId", group.RemoveComic)
		groupWrite.PUT("/:id/reorder", group.ReorderComics)
		groupWrite.PUT("/:id/metadata", group.UpdateMetadata)
		groupWrite.POST("/:id/inherit-metadata", group.InheritMetadata)
		groupWrite.POST("/:id/preview-inherit", group.PreviewInherit)
		groupWrite.POST("/:id/inherit-to-volumes", group.InheritToVolumes)
		// P2: 系列级标签管理
		groupWrite.GET("/:id/tags", group.GetGroupTags)
		groupWrite.PUT("/:id/tags", group.SetGroupTags)
		groupWrite.POST("/:id/sync-tags", group.SyncGroupTags)
		groupWrite.POST("/:id/override-tags", group.OverrideGroupTags)
		groupWrite.POST("/:id/ai-suggest-tags", group.AISuggestTags)
		// P5: 系列级分类管理
		groupWrite.GET("/:id/categories", group.GetGroupCategories)
		groupWrite.PUT("/:id/categories", group.SetGroupCategories)
		groupWrite.POST("/:id/sync-categories", group.SyncGroupCategories)
		groupWrite.POST("/:id/ai-suggest-categories", group.AISuggestCategories)
		// P4: 系列级元数据刮削 & AI 识别
		groupWrite.POST("/:id/scrape-metadata", middleware.ScraperRequired(), group.ScrapeMetadata)
		groupWrite.POST("/:id/apply-metadata", middleware.ScraperRequired(), group.ApplyScrapedMetadata)
		groupWrite.POST("/:id/ai-recognize", middleware.ScraperRequired(), group.AIRecognize)
		// P3: 按话/卷自动分组
		groupWrite.POST("/auto-group-by-dir", group.AutoGroupByDirectory)
		groupWrite.POST("/auto-detect", group.AutoDetect)
		groupWrite.POST("/batch-create", group.BatchCreate)
		groupWrite.POST("/batch-delete", group.BatchDelete)
		groupWrite.POST("/batch-scrape", middleware.ScraperRequired(), group.BatchScrape)
		groupWrite.POST("/merge", group.MergeGroups)
		groupWrite.POST("/export", group.ExportGroups)
		// 脏数据检测与清理
		groupWrite.POST("/detect-dirty", group.DetectDirty)
		groupWrite.POST("/cleanup", group.Cleanup)
		groupWrite.POST("/fix-name", group.FixName)
	}

	// ============================================================
	// Error Logs (错误日志查看) — requires admin
	// ============================================================
	logH := NewLogHandler()
	logGroup := api.Group("/logs")
	logGroup.Use(middleware.AdminRequired())
	{
		logGroup.GET("", logH.GetErrorLogs)
		logGroup.GET("/stats", logH.GetErrorLogStats)
		logGroup.GET("/export", logH.ExportErrorLogs)
		logGroup.DELETE("", logH.ClearErrorLogs)
	}

	// ============================================================
	// Metadata Sync (元数据同步) — requires admin
	// ============================================================
	syncH := NewSyncHandler()
	syncGroup := api.Group("/sync")
	syncGroup.Use(middleware.AdminRequired())
	{
		syncGroup.GET("/status", syncH.Status)
		syncGroup.GET("/history", syncH.History)
		syncGroup.GET("/diff/:id", syncH.Diff)
		syncGroup.POST("/push", syncH.Push)
		syncGroup.POST("/revert", syncH.Revert)
	}
}
