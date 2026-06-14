package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nowen-reader/nowen-reader/internal/service"
)

// DataQAHandler handles data quality scan API endpoints.
type DataQAHandler struct{}

// NewDataQAHandler creates a new DataQAHandler.
func NewDataQAHandler() *DataQAHandler {
	return &DataQAHandler{}
}

// GetSummary returns a summary of data consistency issues.
func (h *DataQAHandler) GetSummary(c *gin.Context) {
	issues, err := service.ScanDataIssues()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Scan failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, service.BuildSummary(issues))
}

// GetIssues returns the full list of data consistency issues.
func (h *DataQAHandler) GetIssues(c *gin.Context) {
	issues, err := service.ScanDataIssues()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Scan failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"issues": issues})
}

// FixPreview returns a dry-run fix preview without modifying any data.
func (h *DataQAHandler) FixPreview(c *gin.Context) {
	var body struct {
		IssueTypes []string `json:"issueTypes"`
		IssueIDs   []string `json:"issueIds"`
		FixAll     bool     `json:"fixAll"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	result, err := service.BuildFixPreview(body.IssueTypes, body.IssueIDs, body.FixAll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fix preview failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
