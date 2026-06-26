package middleware

import (
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nowen-reader/nowen-reader/internal/model"
	"github.com/nowen-reader/nowen-reader/internal/store"
	"golang.org/x/crypto/bcrypt"
)

const (
	SessionCookie = "nowen_session"
	SessionMaxAge = 30 * 24 * 60 * 60 // 30 days in seconds
)

// contextKey constants
const (
	ContextKeyUser = "auth_user"

	OPDSUnanthedHeaderKey   = "WWW-Authenticate"
	OPDSUnanthedHeaderValue = `Basic realm="OPDS Library"`
)

func OPDSRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// 无凭证，返回401，触发客户端弹账号密码框
			c.Header(OPDSUnanthedHeaderKey, OPDSUnanthedHeaderValue)
			c.AbortWithStatus(401)
			return
		}

		base64Str := authHeader[6:]
		// base64解码
		decoded, err := base64.StdEncoding.DecodeString(base64Str)
		if err != nil {
			c.Header(OPDSUnanthedHeaderKey, OPDSUnanthedHeaderValue)
			c.AbortWithStatus(401)
			return
		}

		parts := strings.SplitN(string(decoded), ":", 2)
		if len(parts) != 2 {
			c.Header(OPDSUnanthedHeaderKey, OPDSUnanthedHeaderValue)
			c.AbortWithStatus(401)
			return
		}

		username, password := parts[0], parts[1]
		// 校验账号密码
		user, err := store.GetUserByUsername(username)
		if err != nil {
			c.Header(OPDSUnanthedHeaderKey, OPDSUnanthedHeaderValue)
			c.AbortWithStatus(401)
			return
		}
		if user == nil {
			c.Header(OPDSUnanthedHeaderKey, OPDSUnanthedHeaderValue)
			c.AbortWithStatus(401)
			return
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
			c.Header(OPDSUnanthedHeaderKey, OPDSUnanthedHeaderValue)
			c.AbortWithStatus(401)
			return
		}

		// 存入上下文，后续接口取用
		authedUser := &model.AuthUser{
			ID:        user.ID,
			Username:  user.Username,
			Nickname:  user.Nickname,
			Role:      user.Role,
			AiEnabled: user.AiEnabled,
		}
		c.Set(ContextKeyUser, authedUser)
		c.Next()
	}
}

// AuthRequired is a middleware that requires a valid session.
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetCurrentUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		c.Set(ContextKeyUser, user)
		c.Next()
	}
}

// AdminRequired is a middleware that requires an admin user.
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetCurrentUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		if user.Role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		c.Set(ContextKeyUser, user)
		c.Next()
	}
}

// AIRequired is a middleware that requires the user to have AI access enabled.
// Admin users always have AI access. Non-admin users need explicit aiEnabled flag.
func AIRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetCurrentUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		if user.Role != "admin" && !user.AiEnabled {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "AI access not enabled for your account"})
			return
		}
		c.Set(ContextKeyUser, user)
		c.Next()
	}
}

// GetCurrentUser extracts and validates the session from the request cookie.
// Returns nil if no valid session found.
func GetCurrentUser(c *gin.Context) *model.AuthUser {
	// Check if already resolved in this request
	if u, exists := c.Get(ContextKeyUser); exists {
		if user, ok := u.(*model.AuthUser); ok {
			return user
		}
	}

	token, err := c.Cookie(SessionCookie)
	if err != nil || token == "" {
		return nil
	}

	session, user, err := store.GetSessionWithUser(token)
	if err != nil || session == nil || user == nil {
		return nil
	}

	// Check expiration
	if session.ExpiresAt.Before(time.Now()) {
		// Clean up expired session
		_ = store.DeleteSession(token)
		return nil
	}

	// 自动续期：当 Session 剩余有效期不足 7 天时，自动延长到 30 天
	const renewThreshold = 7 * 24 * time.Hour
	if time.Until(session.ExpiresAt) < renewThreshold {
		newExpiry := time.Now().Add(time.Duration(SessionMaxAge) * time.Second)
		if err := store.RenewSession(token, newExpiry); err == nil {
			SetSessionCookie(c, token)
		}
	}

	authUser := &model.AuthUser{
		ID:        user.ID,
		Username:  user.Username,
		Nickname:  user.Nickname,
		Role:      user.Role,
		AiEnabled: user.AiEnabled,
	}
	return authUser
}

// IsRequestSecure determines if the request is over HTTPS.
// Checks X-Forwarded-Proto for reverse proxy scenarios (NAS/LAN).
func IsRequestSecure(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	forwarded := c.GetHeader("X-Forwarded-Proto")
	return strings.Contains(strings.ToLower(forwarded), "https")
}

// SetSessionCookie sets the session cookie on the response.
// 注意：不设置 Secure 标志，因为：
// 1. 本项目主要用于局域网/NAS 环境，很多用户通过 HTTP 访问
// 2. Flutter App (dio_cookie_manager) 在 HTTP 连接时不会发送 Secure Cookie
// 3. httpOnly=true 已经提供了足够的 XSS 防护
func SetSessionCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(SessionCookie, token, SessionMaxAge, "/", "", false, true)
}

// ClearSessionCookie removes the session cookie.
func ClearSessionCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(SessionCookie, "", -1, "/", "", false, true)
}
