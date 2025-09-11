package main

import (
	"encoding/json"
	"errors"
	"os"
	"sync"
)

type GroupItem struct {
	Name     string   `json:"name"`
	Remark   string   `json:"remark"`
	EnvList  []EnvVar `json:"envList"`
	Selected bool     `json:"selected"`
}

type Group struct {
	Name     string      `json:"name"`
	Remark   string      `json:"remark"`
	ItemList []GroupItem `json:"itemList"`
}

type GroupStore struct {
	mu       sync.RWMutex
	groups   []Group
	filePath string
}

var groupStore *GroupStore

func initGroupStore() *GroupStore {
	if groupStore != nil {
		return groupStore
	}

	// 使用当前项目目录
	filePath := "env_group.json"

	store := &GroupStore{
		groups:   make([]Group, 0),
		filePath: filePath,
	}

	// Load existing groups - 不管是否成功都要继续
	if err := store.loadGroups(); err != nil {
		// 如果文件不存在，尝试创建空文件，但不强制要求成功
		if os.IsNotExist(err) {
			// 忽略保存错误，因为这不应该阻止程序运行
			_ = store.saveGroups()
		}
	}

	groupStore = store
	return store
}

func (gs *GroupStore) loadGroups() error {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	data, err := os.ReadFile(gs.filePath)
	if os.IsNotExist(err) {
		// 如果文件不存在，属性列表置空
		gs.groups = make([]Group, 0)
		return err
	}
	if err != nil {
		gs.groups = make([]Group, 0)
		return err
	}

	if len(data) == 0 {
		// 如果文件为空或只包含空白字符，属性列表置空
		gs.groups = make([]Group, 0)
		return nil
	}

	var groups []Group
	if err := json.Unmarshal(data, &groups); err != nil {
		// JSON解析错误，初始化为空的属性列表
		gs.groups = make([]Group, 0)
		return err
	}

	gs.groups = append(gs.groups, groups...)

	return nil
}

func (gs *GroupStore) saveGroups() error {
	gs.mu.RLock()
	defer gs.mu.RUnlock()

	data, err := json.MarshalIndent(gs.groups, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(gs.filePath, data, 0644)
}

func (gs *GroupStore) GetAllGroups() []Group {
	return gs.groups
}

func (gs *GroupStore) SetGroup(g Group) error {
	index := -1
	for i, v := range gs.groups {
		if v.Name == g.Name {
			index = i
			break
		}
	}

	if index > -1 {
		gs.groups[index] = g
	} else {
		gs.groups = append(gs.groups, g)
	}

	return gs.saveGroups()
}

func (gs *GroupStore) GetGroup(name string) (Group, error) {
	for _, g := range gs.groups {
		if g.Name == name {
			return g, nil
		}
	}
	return Group{}, errors.New("group not found")
}

func (gs *GroupStore) DeleteGroup(name string) error {
	// 查找并删除匹配的属性
	for i, g := range gs.groups {
		if g.Name == name {
			gs.groups = append(gs.groups[:i], gs.groups[i+1:]...)
			return gs.saveGroups()
		}
	}

	// 如果没找到匹配的属性，直接返回成功
	return nil
}
