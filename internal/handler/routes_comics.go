package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/nowen-reader/nowen-reader/internal/middleware"
)

func registerComicRoutes(api *gin.RouterGroup) {
	// Comics CRUD (Phase 2)
	// ============================================================
	comic := NewComicHandler()

	// Comics listing (read-only, no auth needed for browsing)
	api.GET("/comics", comic.ListComics)
	api.GET("/comics/duplicates", comic.DetectDuplicates)

	// Comics write ops (require admin — 非管理员只读)
	comicsWrite := api.Group("/comics")
	comicsWrite.Use(middleware.AdminRequired())
	{
		comicsWrite.POST("/batch", comic.BatchOperation)
		comicsWrite.PUT("/reorder", comic.Reorder)
	}

	// Comics admin ops (require admin)
	comicsAdmin := api.Group("/comics")
	comicsAdmin.Use(middleware.AdminRequired())
	{
		comicsAdmin.POST("/cleanup", comic.CleanupInvalid)
		comicsAdmin.POST("/redetect-types", comic.RedetectTypes)
	}

	// Single comic read operations (no auth)
	comicByID := api.Group("/comics/:id")
	{
		comicByID.GET("", comic.GetComic)
	}

	// Single comic write operations (require admin — 非管理员只读)
	comicByIDWrite := api.Group("/comics/:id")
	comicByIDWrite.Use(middleware.AdminRequired())
	{
		comicByIDWrite.PUT("/favorite", comic.ToggleFavorite)
		comicByIDWrite.PUT("/rating", comic.UpdateRating)

		// Tags per comic
		comicByIDWrite.POST("/tags", comic.AddTags)
		comicByIDWrite.DELETE("/tags", comic.RemoveTag)
		comicByIDWrite.DELETE("/tags/clear-all", comic.ClearAllTags)

		// Categories per comic
		comicByIDWrite.POST("/categories", comic.AddCategories)
		comicByIDWrite.PUT("/categories", comic.SetCategories)
		comicByIDWrite.DELETE("/categories", comic.RemoveCategory)

		// Metadata editing
		comicByIDWrite.PUT("/metadata", comic.UpdateMetadata)
	}

	// 阅读进度和状态（所有登录用户可用，非管理员也需要保存阅读进度）
	comicByIDAuth := api.Group("/comics/:id")
	comicByIDAuth.Use(middleware.AuthRequired())
	{
		comicByIDAuth.PUT("/progress", comic.UpdateProgress)
		comicByIDAuth.PUT("/reading-status", comic.SetReadingStatus)
	}

	// 单本漫画管理员操作（删除等危险操作需要管理员权限）
	comicByIDAdmin := api.Group("/comics/:id")
	comicByIDAdmin.Use(middleware.AdminRequired())
	{
		comicByIDAdmin.DELETE("/delete", comic.DeleteComic)
	}

	// ============================================================


	// Sync trigger (Phase 2) — requires admin
	syncTrigger := api.Group("")
	syncTrigger.Use(middleware.AdminRequired())
	{
		syncTrigger.POST("/sync", comic.TriggerSync)
	}

	// Image serving (Phase 3)
	img := NewImageHandler()

	comicByID.GET("/pages", img.GetPages)
	comicByID.GET("/thumbnail", img.GetThumbnail)
	comicByIDWrite.POST("/cover", img.UpdateCover)
	api.GET("/comics/:id/page/:pageIndex", img.GetPageImage)
	api.GET("/comics/:id/pdf", img.GetPdfFile)
	api.GET("/comics/:id/chapter/:chapterIndex", img.GetChapterContent)
	api.GET("/comics/:id/epub-resource/*resourcePath", img.GetEpubResource)
	api.GET("/comics/:id/embedded-images", img.GetEmbeddedImages)
	api.GET("/comics/:id/embedded-image/:index", img.GetEmbeddedImage)
	api.POST("/comics/:id/warmup", img.WarmupPages)
	api.POST("/comics/:id/warmup-done", img.WarmupDone)

	// Per-comic metadata translation (requires auth)
	tagTranslate := NewTagTranslateHandler()
	comicByIDWrite.POST("/translate-metadata", tagTranslate.TranslateMetadata)

}
