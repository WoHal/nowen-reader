package handler

import (
	"net/http"
	"os/exec"
	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/nowen-reader/nowen-reader/internal/config"
)

// pdfRendererStatus 描述当前服务器 PDF 渲染工具的可用情况，用于前端提前感知。
type pdfRendererStatus struct {
	Available bool              `json:"available"`        // 是否至少安装了一个可用工具
	Tools     map[string]string `json:"tools"`            // 工具名 -> 路径（未找到为空字符串）
	Active    string            `json:"active,omitempty"` // 实际会被使用的工具（按优先级 mutool > pdftoppm > convert）
	OS        string            `json:"os"`               // 运行操作系统，便于前端给出针对性安装提示
	Hint      string            `json:"hint,omitempty"`   // 安装提示文案
}

// GetPdfRendererStatus 返回 PDF 渲染工具的安装情况。
// 前端在打开 PDF 阅读器、内页选封面对话框时调用，以决定是否展示醒目的安装提示。
//
// GET /api/system/pdf-renderer
func GetPdfRendererStatus(c *gin.Context) {
	tools := map[string]string{
		"mutool":   "",
		"pdftoppm": "",
		"convert":  "",
	}

	for name := range tools {
		if p, ok := config.LookPdfTool(name, exec.LookPath); ok {
			tools[name] = p
		}
	}

	// 按渲染代码里的优先级决定 Active
	var active string
	switch {
	case tools["mutool"] != "":
		active = "mutool"
	case tools["pdftoppm"] != "":
		active = "pdftoppm"
	case tools["convert"] != "":
		active = "convert"
	}

	available := active != ""

	hint := ""
	if !available {
		switch runtime.GOOS {
		case "windows":
			hint = "未检测到 PDF 渲染工具。请下载 mutool（MuPDF）单文件可执行程序，放入 PATH 或在站点设置 → 高级 中填写 PdfRendererPath。"
		case "darwin":
			hint = "未检测到 PDF 渲染工具。建议执行：brew install mupdf-tools 或 brew install poppler。"
		default:
			hint = "未检测到 PDF 渲染工具。建议安装 mupdf-tools 或 poppler-utils（Debian/Ubuntu: apt install mupdf-tools；Alpine: apk add mupdf-tools）。"
		}
	}

	c.JSON(http.StatusOK, pdfRendererStatus{
		Available: available,
		Tools:     tools,
		Active:    active,
		OS:        runtime.GOOS,
		Hint:      hint,
	})
}
