package main

import (
	"encoding/json"
	"os"
	"sync"
)

type EnvComment struct {
	Name    string `json:"name"`
	Comment string `json:"comment"`
}

type CommentStore struct {
	mu       sync.RWMutex
	comments map[string]string // varName -> comment
	filePath string
}

var commentStore *CommentStore

func initCommentStore() *CommentStore {
	if commentStore != nil {
		return commentStore
	}

	// 使用当前项目目录
	filePath := "envmgr_comments.json"

	store := &CommentStore{
		comments: make(map[string]string),
		filePath: filePath,
	}

	// Load existing comments - 不管是否成功都要继续
	if err := store.loadComments(); err != nil {
		// 如果文件不存在，尝试创建空文件，但不强制要求成功
		if os.IsNotExist(err) {
			// 忽略保存错误，因为这不应该阻止程序运行
			_ = store.saveComments()
		}
		// 对于其他错误，也不应该阻止程序运行
		// store.comments 已经在loadComments中初始化为空map
	}

	commentStore = store
	return store
}

func (cs *CommentStore) loadComments() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	data, err := os.ReadFile(cs.filePath)
	if os.IsNotExist(err) {
		// 文件不存在，初始化为空的map
		cs.comments = make(map[string]string)
		return err
	}
	if err != nil {
		// 其他读取错误，初始化为空的map
		cs.comments = make(map[string]string)
		return err
	}

	// 如果文件为空或只包含空白字符，初始化为空的map
	if len(data) == 0 {
		cs.comments = make(map[string]string)
		return nil
	}

	var comments []EnvComment
	if err := json.Unmarshal(data, &comments); err != nil {
		// JSON解析错误，初始化为空的map
		cs.comments = make(map[string]string)
		return err
	}

	// Convert slice to map for easier lookup
	cs.comments = make(map[string]string)
	for _, comment := range comments {
		cs.comments[comment.Name] = comment.Comment
	}

	return nil
}

func (cs *CommentStore) saveComments() error {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	// Convert map to slice for JSON storage
	var comments []EnvComment
	for name, comment := range cs.comments {
		comments = append(comments, EnvComment{
			Name:    name,
			Comment: comment,
		})
	}

	data, err := json.MarshalIndent(comments, "", "  ")
	if err != nil {
		return err
	}

	// Ensure we write empty array instead of null
	if len(comments) == 0 {
		data = []byte("[]")
	}

	return os.WriteFile(cs.filePath, data, 0644)
}

func (cs *CommentStore) GetComment(name string) string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	return cs.comments[name]
}

func (cs *CommentStore) SetComment(name, comment string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if comment == "" {
		delete(cs.comments, name)
	} else {
		cs.comments[name] = comment
	}

	return cs.saveComments()
}

func (cs *CommentStore) GetAllComments() map[string]string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	result := make(map[string]string)
	for k, v := range cs.comments {
		result[k] = v
	}

	return result
}

func (cs *CommentStore) DeleteComment(name string) error {
	return cs.SetComment(name, "")
}

// Helper functions
func GetEnvVarComment(name string) string {
	store := initCommentStore()
	return store.GetComment(name)
}

func SetEnvVarComment(name, comment string) error {
	store := initCommentStore()
	return store.SetComment(name, comment)
}

func DeleteEnvVarComment(name string) error {
	store := initCommentStore()
	return store.DeleteComment(name)
}

func GetAllEnvVarComments() map[string]string {
	store := initCommentStore()
	return store.GetAllComments()
}