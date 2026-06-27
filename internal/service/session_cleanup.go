package service

import (
	"log"
	"strings"
	"time"

	"github.com/nowen-reader/nowen-reader/internal/store"
)

// StartSessionCleanup 定期清理过期的用户 Session（每 6 小时执行一次）。
func StartSessionCleanup() {
	go func() {
		// 延迟 30 秒再首次执行，避免与 FTS 重建、后台同步等启动写操作竞争 SQLITE_BUSY
		time.Sleep(30 * time.Second)

		cleanExpiredSessions()

		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			cleanExpiredSessions()
		}
	}()
	log.Println("[session-cleanup] Session cleanup scheduler started (interval: 6h, initial delay: 30s)")
}

func cleanExpiredSessions() {
	// 带重试：如果遇到 SQLITE_BUSY，最多重试 3 次，每次间隔递增
	var count int64
	var err error
	const maxRetries = 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		count, err = store.CleanExpiredSessions()
		if err == nil {
			break
		}
		// SQLITE_BUSY (错误码 5) 或 "database is locked" 时重试
		if isBusyError(err) {
			backoff := time.Duration(attempt) * 2 * time.Second
			log.Printf("[session-cleanup] Database busy (attempt %d/%d), retrying in %v...", attempt, maxRetries, backoff)
			time.Sleep(backoff)
			continue
		}
		// 非 BUSY 错误直接退出
		log.Printf("[session-cleanup] Error cleaning sessions: %v", err)
		return
	}
	if count > 0 {
		log.Printf("[session-cleanup] Cleaned %d expired sessions", count)
	}
}

// isBusyError 判断错误是否为 SQLITE_BUSY / database is locked。
func isBusyError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "database is locked") ||
		strings.Contains(msg, "SQLITE_BUSY") ||
		strings.Contains(msg, "busy")
}
