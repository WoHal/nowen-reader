package handler

import (
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
)

// Build info — set by main package
var (
	AppVersion = "dev"
	startTime  = time.Now()
)

// SetupRoutes registers all API routes on the given Gin engine.
func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")

	api.GET("/health", func(c *gin.Context) {
		var memStats runtime.MemStats
		runtime.ReadMemStats(&memStats)
		c.JSON(200, gin.H{
			"status":  "ok",
			"version": AppVersion,
			"uptime":  time.Since(startTime).String(),
			"runtime": gin.H{
				"go":         runtime.Version(),
				"os":         runtime.GOOS,
				"arch":       runtime.GOARCH,
				"cpus":       runtime.NumCPU(),
				"goroutines": runtime.NumGoroutine(),
				"memoryMB":   memStats.Alloc / 1024 / 1024,
			},
		})
	})

	api.GET("/system/pdf-renderer", GetPdfRendererStatus)

	registerAuthRoutes(api)
	registerComicRoutes(api)
	registerContentRoutes(api)
	registerMetadataRoutes(api)
}


