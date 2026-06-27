package service

import (
	"math"
	"math/rand"
	"sort"
	"strings"
	"time"

	"log"

	"github.com/nowen-reader/nowen-reader/internal/store"
)

// ScoredComic represents a recommended comic with scoring details.
type ScoredComic struct {
	ID       string               `json:"id"`
	Title    string               `json:"title"`
	Score    float64              `json:"score"`
	Reasons  []string             `json:"reasons"`
	AIReason string               `json:"aiReason,omitempty"` // AI 生成的自然语言推荐理由
	CoverURL string               `json:"coverUrl"`
	Author   string               `json:"author"`
	Genre    string               `json:"genre"`
	Filename string               `json:"filename"`
	Tags     []store.ComicTagInfo `json:"tags"`
}

// GetRecommendations returns personalized comic recommendations.
// seed > 0 时会在评分上添加随机扰动，使每次刷新结果不同。
func GetRecommendations(limit int, excludeRead bool, contentType string, seed int64, libraryIDs ...string) ([]ScoredComic, error) {
	allComics, err := store.GetAllComicsForRecommendation(libraryIDs...)
	if err != nil {
		log.Printf("[Recommendation] GetAllComicsForRecommendation error: %v (libraryIDs=%v)", err, libraryIDs)
		return nil, err
	}
	if len(allComics) == 0 {
		log.Printf("[Recommendation] no comics found (libraryIDs=%v)", libraryIDs)
		return []ScoredComic{}, nil
	}

	// 先按内容类型过滤候选集，再基于过滤后的内容构建用户画像
	// 这样可以确保：1) 画像仅反映目标类型的用户偏好；2) 无匹配内容时直接返回空结果
	candidates := make([]store.RecommendationComic, 0, len(allComics))
	for _, comic := range allComics {
		// Legacy data may have empty type; treat empty as "comic" since most content is comics
		if contentType == "novel" && comic.Type != "novel" {
			continue
		}
		if contentType == "comic" && comic.Type != "comic" && comic.Type != "" {
			continue
		}
		candidates = append(candidates, comic)
	}

	// Debug: log type distribution
	typeCounts := map[string]int{}
	for _, c := range allComics {
		typeCounts[c.Type]++
	}
	log.Printf("[Recommendation] allComics=%d, contentType=%q, candidates=%d, typeDistribution=%v, libraryIDs=%v",
		len(allComics), contentType, len(candidates), typeCounts, libraryIDs)

	// 过滤后无匹配内容，直接返回空结果
	if len(candidates) == 0 {
		return []ScoredComic{}, nil
	}

	// 基于过滤后的候选集构建用户画像，确保推荐偏好与目标内容类型一致
	profile := buildUserProfile(candidates)

	// 根据 seed 创建随机源（seed==0 时不添加随机扰动）
	var rng *rand.Rand
	if seed > 0 {
		rng = rand.New(rand.NewSource(seed))
	}

	// 预分配切片，避免循环中多次扩容
	scored := make([]ScoredComic, 0, len(candidates))
	// 延迟生成 CoverURL：避免在评分循环中对每个候选做 os.Stat 调用
	// CoverURL 只在最终排好序的 top-N 结果中填充
	for _, comic := range candidates {

		if excludeRead && comic.LastReadPage > 0 && comic.PageCount > 0 {
			progress := float64(comic.LastReadPage) / float64(comic.PageCount)
			if progress >= 0.9 {
				continue
			}
		}

		score, reasons := calculateRecommendationScore(comic, profile)

		// 添加随机扰动（±20%），使刷新结果有变化
		if rng != nil && score > 0 {
			jitter := 0.8 + rng.Float64()*0.4
			score *= jitter
		}

		scored = append(scored, ScoredComic{
			ID:       comic.ID,
			Title:    comic.Title,
			Score:    score,
			Reasons:  reasons,
			Author:   comic.Author,
			Genre:    comic.Genre,
			Filename: comic.Filename,
			Tags:     comic.Tags,
		})
	}

	// 使用 sort.Slice 替代冒泡排序，O(n²) → O(n log n)
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	if limit > 0 && len(scored) > limit {
		scored = scored[:limit]
	}

	// 仅为最终返回的 top-N 结果填充 CoverURL（延迟 os.Stat 调用）
	for i := range scored {
		scored[i].CoverURL = store.BuildComicCoverURL(scored[i].ID)
	}

	return scored, nil
}

// GetSimilarComics returns comics similar to a given comic.
// 优化：使用 SQL 层预筛选（标签/类型/作者交集），只查询相关候选而非全库。
func GetSimilarComics(comicID string, limit int, libraryIDs ...string) ([]ScoredComic, error) {
	target, err := store.GetComicByID(comicID)
	if err != nil || target == nil {
		return []ScoredComic{}, nil
	}

	targetTagNames := make([]string, 0, len(target.Tags))
	for _, t := range target.Tags {
		targetTagNames = append(targetTagNames, t.Name)
	}
	targetGenreList := make([]string, 0)
	for _, g := range strings.Split(target.Genre, ",") {
		g = strings.TrimSpace(g)
		if g != "" {
			targetGenreList = append(targetGenreList, g)
		}
	}
	targetAuthor := target.Author

	// SQL 层预筛选候选漫画，大幅减少数据传输和内存占用
	candidates, err := store.GetComicsForSimilarity(targetTagNames, targetGenreList, targetAuthor, comicID, libraryIDs...)
	if err != nil {
		return nil, err
	}

	targetTags := map[string]bool{}
	for _, t := range target.Tags {
		targetTags[t.Name] = true
	}
	targetGenres := map[string]bool{}
	for _, g := range targetGenreList {
		targetGenres[g] = true
	}
	targetCats := map[string]bool{}
	for _, c := range target.Categories {
		targetCats[c.Slug] = true
	}

	var scored []ScoredComic
	for _, comic := range candidates {
		var score float64
		var reasons []string

		// Tag overlap (Jaccard)
		comicTags := map[string]bool{}
		for _, t := range comic.Tags {
			comicTags[t.Name] = true
		}
		intersection := 0
		for t := range targetTags {
			if comicTags[t] {
				intersection++
			}
		}
		unionSize := len(targetTags)
		for t := range comicTags {
			if !targetTags[t] {
				unionSize++
			}
		}
		if unionSize > 0 {
			tagSim := float64(intersection) / float64(unionSize)
			score += tagSim * 40
			if tagSim > 0.3 {
				reasons = append(reasons, "similar_tags")
			}
		}

		// Genre overlap
		comicGenres := map[string]bool{}
		for _, g := range strings.Split(comic.Genre, ",") {
			g = strings.TrimSpace(g)
			if g != "" {
				comicGenres[g] = true
			}
		}
		genreIntersection := 0
		for g := range targetGenres {
			if comicGenres[g] {
				genreIntersection++
			}
		}
		genreUnion := len(targetGenres)
		for g := range comicGenres {
			if !targetGenres[g] {
				genreUnion++
			}
		}
		if genreUnion > 0 {
			genreSim := float64(genreIntersection) / float64(genreUnion)
			score += genreSim * 30
			if genreSim > 0.3 {
				reasons = append(reasons, "similar_genre")
			}
		}

		// Same author
		if comic.Author != "" && comic.Author == targetAuthor {
			score += 20
			reasons = append(reasons, "same_author")
		}

		// Same category
		for _, c := range comic.Categories {
			if targetCats[c.Slug] {
				score += 8
				reasons = append(reasons, "same_category")
				break
			}
		}

		if score > 0 {
			scored = append(scored, ScoredComic{
				ID:       comic.ID,
				Title:    comic.Title,
				Score:    score,
				Reasons:  reasons,
				Author:   comic.Author,
				Genre:    comic.Genre,
				Filename: comic.Filename,
				Tags:     comic.Tags,
			})
		}
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	if limit > 0 && len(scored) > limit {
		scored = scored[:limit]
	}

	// 仅为最终结果填充 CoverURL
	for i := range scored {
		scored[i].CoverURL = store.BuildComicCoverURL(scored[i].ID)
	}

	log.Printf("[SimilarComics] comicID=%s, candidates=%d, scored=%d", comicID, len(candidates), len(scored))

	// Fallback: when no similar comics found, return random comics from same library scope.
	if len(scored) == 0 && len(candidates) > 1 {
		var fallback []ScoredComic
		for _, comic := range candidates {
			if comic.ID == comicID {
				continue
			}
			fallback = append(fallback, ScoredComic{
				ID:       comic.ID,
				Title:    comic.Title,
				Score:    0,
				Reasons:  []string{"recommended"},
				Author:   comic.Author,
				Genre:    comic.Genre,
				Filename: comic.Filename,
				Tags:     comic.Tags,
			})
		}
		// 如果 SQL 筛选的候选不够，回退到全量加载做兜底
		if len(fallback) < limit {
			allComics, err2 := store.GetAllComicsForRecommendation(libraryIDs...)
			if err2 == nil && len(allComics) > len(fallback) {
				for _, comic := range allComics {
					if comic.ID == comicID {
						continue
					}
					alreadyIn := false
					for _, fb := range fallback {
						if fb.ID == comic.ID {
							alreadyIn = true
							break
						}
					}
					if !alreadyIn {
						fallback = append(fallback, ScoredComic{
							ID:       comic.ID,
							Title:    comic.Title,
							Score:    0,
							Reasons:  []string{"recommended"},
							Author:   comic.Author,
							Genre:    comic.Genre,
							Filename: comic.Filename,
							Tags:     comic.Tags,
						})
					}
				}
			}
		}
		rand.Shuffle(len(fallback), func(i, j int) { fallback[i], fallback[j] = fallback[j], fallback[i] })
		if limit > 0 && len(fallback) > limit {
			fallback = fallback[:limit]
		}
		for i := range fallback {
			fallback[i].CoverURL = store.BuildComicCoverURL(fallback[i].ID)
		}
		log.Printf("[SimilarComics] fallback: returning %d comics", len(fallback))
		return fallback, nil
	}
	return scored, nil
}

// ============================================================
// Internal
// ============================================================

type userProfile struct {
	tagWeights    map[string]float64
	genreWeights  map[string]float64
	authorWeights map[string]float64
	avgRating     float64
}

func buildUserProfile(comics []store.RecommendationComic) userProfile {
	p := userProfile{
		tagWeights:    map[string]float64{},
		genreWeights:  map[string]float64{},
		authorWeights: map[string]float64{},
	}

	var totalRating float64
	var ratedCount int
	now := time.Now()

	for _, c := range comics {
		// 快速跳过无交互的漫画（没有阅读记录、没有评分、没有收藏）
		if c.TotalReadTime == 0 && c.LastReadPage == 0 && c.Rating == nil && !c.IsFavorite {
			continue
		}

		engagement := calculateEngagementFast(c, now)
		if engagement <= 0 {
			continue
		}

		for _, t := range c.Tags {
			p.tagWeights[t.Name] += engagement
		}

		if c.Genre != "" {
			for _, g := range strings.Split(c.Genre, ",") {
				g = strings.TrimSpace(g)
				if g != "" {
					p.genreWeights[g] += engagement
				}
			}
		}

		if c.Author != "" {
			p.authorWeights[c.Author] += engagement
		}

		if c.Rating != nil {
			totalRating += float64(*c.Rating)
			ratedCount++
		}
	}

	if ratedCount > 0 {
		p.avgRating = totalRating / float64(ratedCount)
	} else {
		p.avgRating = 3
	}
	return p
}

// calculateEngagementFast 同 calculateEngagement，但接收预计算的 now 时间避免重复调用 time.Now()。
func calculateEngagementFast(c store.RecommendationComic, now time.Time) float64 {
	var score float64

	readTime := c.TotalReadTime
	if readTime > 0 {
		score += math.Min(float64(readTime)/600, 5)
	}

	if c.PageCount > 0 && c.LastReadPage > 0 {
		progress := float64(c.LastReadPage) / float64(c.PageCount)
		score += progress * 3
	}

	if c.Rating != nil {
		score += (float64(*c.Rating) - 2.5) * 2
	}

	if c.IsFavorite {
		score += 3
	}

	if c.LastReadAt != nil {
		daysSince := now.Sub(*c.LastReadAt).Hours() / 24
		if daysSince < 7 {
			score += 2
		} else if daysSince < 30 {
			score += 1
		}
	}

	return score
}

func calculateEngagement(c store.RecommendationComic) float64 {
	var score float64

	readTime := c.TotalReadTime
	if readTime > 0 {
		score += math.Min(float64(readTime)/600, 5)
	}

	if c.PageCount > 0 && c.LastReadPage > 0 {
		progress := float64(c.LastReadPage) / float64(c.PageCount)
		score += progress * 3
	}

	if c.Rating != nil {
		score += (float64(*c.Rating) - 2.5) * 2
	}

	if c.IsFavorite {
		score += 3
	}

	if c.LastReadAt != nil {
		daysSince := time.Since(*c.LastReadAt).Hours() / 24
		if daysSince < 7 {
			score += 2
		} else if daysSince < 30 {
			score += 1
		}
	}

	return score
}

func calculateRecommendationScore(c store.RecommendationComic, profile userProfile) (float64, []string) {
	var score float64
	var reasons []string

	// Tag match
	var tagScore float64
	for _, t := range c.Tags {
		tagScore += profile.tagWeights[t.Name]
	}
	if tagScore > 0 {
		normalized := math.Min(tagScore/10, 30)
		score += normalized
		if normalized > 5 {
			reasons = append(reasons, "tag_match")
		}
	}

	// Genre match
	if c.Genre != "" {
		var genreScore float64
		for _, g := range strings.Split(c.Genre, ",") {
			g = strings.TrimSpace(g)
			genreScore += profile.genreWeights[g]
		}
		if genreScore > 0 {
			normalized := math.Min(genreScore/10, 25)
			score += normalized
			if normalized > 5 {
				reasons = append(reasons, "genre_match")
			}
		}
	}

	// Author match
	if c.Author != "" {
		if w := profile.authorWeights[c.Author]; w > 0 {
			normalized := math.Min(w/5, 20)
			score += normalized
			reasons = append(reasons, "same_author")
		}
	}

	// Rating prediction
	if c.Rating != nil && float64(*c.Rating) >= profile.avgRating {
		score += (float64(*c.Rating) - profile.avgRating) * 3
		reasons = append(reasons, "highly_rated")
	}

	// Unread bonus
	if c.LastReadPage == 0 && c.PageCount > 0 {
		score += 5
		reasons = append(reasons, "unread")
	}

	// Recency penalty
	if c.LastReadAt != nil {
		daysSince := time.Since(*c.LastReadAt).Hours() / 24
		if daysSince < 1 {
			score -= 10
		} else if daysSince < 3 {
			score -= 5
		}
	}

	if score < 0 {
		score = 0
	}
	if reasons == nil {
		reasons = []string{}
	}
	return score, reasons
}

// IsNovelFilename 判断文件名是否为小说格式
func IsNovelFilename(filename string) bool {
	lower := strings.ToLower(filename)
	return strings.HasSuffix(lower, ".txt") ||
		strings.HasSuffix(lower, ".epub") ||
		strings.HasSuffix(lower, ".mobi") ||
		strings.HasSuffix(lower, ".azw3")
}
