package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/nowen-reader/nowen-reader/internal/middleware"
)

func registerContentRoutes(api *gin.RouterGroup) {
	// Tags (Phase 2)
	// ============================================================
	tag := NewTagHandler()
	api.GET("/tags", tag.ListTags)

	tagAdmin := api.Group("/tags")
	tagAdmin.Use(middleware.AdminRequired())
	{
		tagAdmin.PUT("/color", tag.UpdateTagColor)
		tagAdmin.PUT("/rename", tag.RenameTag)
		tagAdmin.DELETE("", tag.DeleteTag)
		tagAdmin.POST("/merge", tag.MergeTags)
	}

	// ============================================================
	// Categories (Phase 2)
	// ============================================================
	cat := NewCategoryHandler()
	api.GET("/categories", cat.ListCategories)

	catAdmin := api.Group("/categories")
	catAdmin.Use(middleware.AdminRequired())
	{
		catAdmin.POST("", cat.InitCategories)
		catAdmin.POST("/create", cat.CreateCategory)
		catAdmin.PUT("/reorder", cat.ReorderCategories)
		catAdmin.PUT("/:slug", cat.UpdateCategory)
		catAdmin.DELETE("/:slug", cat.DeleteCategory)
	}

	// ============================================================
	// Reading Stats (Phase 2)
	// ============================================================
	// 阅读统计会话（所有登录用户可用，非管理员也需要记录阅读时长）
	stats := NewStatsHandler()
	api.GET("/stats", stats.GetStats)
	api.GET("/stats/yearly", stats.GetYearlyReport)
	api.GET("/stats/enhanced", stats.GetEnhancedStats)
	api.GET("/stats/files", stats.GetFileStats)
	api.GET("/stats/folder-tree", stats.GetFolderTreeStats)

	statsAuth := api.Group("/stats")
	statsAuth.Use(middleware.AuthRequired())
	{
		statsAuth.POST("/session", stats.StartSession)
		statsAuth.PUT("/session", stats.EndSession)
		statsAuth.POST("/session/end", stats.EndSession) // sendBeacon 兆底（sendBeacon 只支持 POST）
	}
	// ============================================================
	// Upload (Phase 2) — requires admin
	// ============================================================
	upload := NewUploadHandler()
	uploadGroup := api.Group("")
	uploadGroup.Use(middleware.AdminRequired())
	{
		uploadGroup.POST("/upload", upload.Upload)
	}

	// ============================================================
	// Site Settings (Phase 2) — read public, write requires admin
	// ============================================================
	settings := NewSettingsHandler()
	api.GET("/site-settings", settings.GetSettings)
	api.GET("/site-settings/icon", settings.GetIcon)
	settingsWrite := api.Group("")
	settingsWrite.Use(middleware.AdminRequired())
	{
		settingsWrite.PUT("/site-settings", settings.UpdateSettings)
		settingsWrite.POST("/site-settings/icon", settings.UploadIcon)
		settingsWrite.DELETE("/site-settings/icon", settings.DeleteIcon)
	}

	// ============================================================
	// Scan Rules (扫描期统一规则引擎) — 全部需要管理员
	// ============================================================
	scanRules := NewScanRulesHandler()
	scanRulesGroup := api.Group("/scan-rules")
	scanRulesGroup.Use(middleware.AdminRequired())
	{
		scanRulesGroup.GET("", scanRules.Get)
		scanRulesGroup.PUT("", scanRules.Update)
		scanRulesGroup.POST("/apply", scanRules.Apply)
		scanRulesGroup.POST("/preview", scanRules.Preview)
		scanRulesGroup.POST("/restore-titles", scanRules.RestoreTitles)
		scanRulesGroup.GET("/logs", scanRules.Logs)
		scanRulesGroup.GET("/progress", scanRules.Progress)
	}

	// ============================================================
	// Directory Browser (文件夹浏览) — requires admin
	// ============================================================
	browse := NewBrowseHandler()
	browseGroup := api.Group("")
	browseGroup.Use(middleware.AdminRequired())
	{
		browseGroup.GET("/browse-dirs", browse.BrowseDirs)
	}

	// ============================================================
	// Cache management (Phase 3) — requires admin
	// ============================================================
	cache := NewCacheHandler()
	cacheGroup := api.Group("")
	cacheGroup.Use(middleware.AdminRequired())
	{
		cacheGroup.POST("/cache", cache.ClearCache)
	}

	// ============================================================
	// 数据管理（缓存 + 数据库 + 磁盘 + 阈值）— requires admin
	// ============================================================
	dataAdmin := NewDataAdminHandler()
	dataAdminGroup := api.Group("/admin/storage")
	dataAdminGroup.Use(middleware.AdminRequired())
	{
		dataAdminGroup.GET("", dataAdmin.GetOverview)
		dataAdminGroup.GET("/database", dataAdmin.GetDatabaseInfo)
		dataAdminGroup.GET("/history", dataAdmin.GetHistory)
		dataAdminGroup.POST("/cache/clear", dataAdmin.ClearCache)
		dataAdminGroup.POST("/db/checkpoint", dataAdmin.DBCheckpoint)
		dataAdminGroup.POST("/db/analyze", dataAdmin.DBAnalyze)
		dataAdminGroup.POST("/db/vacuum", dataAdmin.DBVacuum)
		dataAdminGroup.POST("/db/integrity", dataAdmin.DBIntegrity)
		dataAdminGroup.PUT("/threshold", dataAdmin.UpdateThreshold)
	}

	// ============================================================
	// Thumbnail management (Phase 3) — requires admin
	// ============================================================
	thumb := NewThumbnailHandler()
	thumbGroup := api.Group("")
	thumbGroup.Use(middleware.AdminRequired())
	{
		thumbGroup.POST("/thumbnails/manage", thumb.ManageThumbnails)
	}

	// ============================================================
	// Reading Goals (阅读目标)
	// ============================================================
	goal := NewGoalHandler()
	api.GET("/goals", goal.GetGoalProgress)
	goalWrite := api.Group("")
	goalWrite.Use(middleware.AdminRequired())
	{
		goalWrite.POST("/goals", goal.SetGoal)
		goalWrite.DELETE("/goals", goal.DeleteGoal)
	}

	// ============================================================
	// Data Export (数据导出)
	// ============================================================
	export := NewExportHandler()
	api.GET("/export/json", export.ExportJSON)
	api.GET("/export/csv/sessions", export.ExportCSV)
	api.GET("/export/csv/comics", export.ExportComicsCSV)

	// ============================================================
}
