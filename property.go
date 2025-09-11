package main

import (
	"encoding/json"
	"os"
	"sync"
)

type Property struct {
	Name   string `json:"name"`
	Source string `json:"source"` // "system" or "user"
	Remark string `json:"remark"`
}

type PropertyStore struct {
	mu         sync.RWMutex
	properties []Property
	filePath   string
}

var propertyStore *PropertyStore

func initPropertyStore() *PropertyStore {
	if propertyStore != nil {
		return propertyStore
	}

	// 使用当前项目目录
	filePath := "env_property.json"

	store := &PropertyStore{
		properties: make([]Property, 0),
		filePath:   filePath,
	}

	// Load existing properties - 不管是否成功都要继续
	if err := store.loadProperties(); err != nil {
		// 如果文件不存在，尝试创建空文件，但不强制要求成功
		if os.IsNotExist(err) {
			// 忽略保存错误，因为这不应该阻止程序运行
			_ = store.saveProperties()
		}
	}

	propertyStore = store
	return store
}

func (ps *PropertyStore) loadProperties() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	data, err := os.ReadFile(ps.filePath)
	if os.IsNotExist(err) {
		// 如果文件不存在，属性列表置空
		ps.properties = make([]Property, 0)
		return err
	}
	if err != nil {
		ps.properties = make([]Property, 0)
		return err
	}

	if len(data) == 0 {
		// 如果文件为空或只包含空白字符，属性列表置空
		ps.properties = make([]Property, 0)
		return nil
	}

	var properties []Property
	if err := json.Unmarshal(data, &properties); err != nil {
		// JSON解析错误，初始化为空的属性列表
		ps.properties = make([]Property, 0)
		return err
	}

	ps.properties = append(ps.properties, properties...)

	return nil
}

func (ps *PropertyStore) saveProperties() error {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	data, err := json.MarshalIndent(ps.properties, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(ps.filePath, data, 0644)
}

func (ps *PropertyStore) SetProperty(p Property) error {
	ps.setProperty(p)
	return ps.saveProperties()
}

func (ps *PropertyStore) BatchSetProperty(properties []Property) error {
	if len(properties) == 0 {
		return nil
	}
	for _, p := range properties {
		ps.setProperty(p)
	}
	return ps.saveProperties()
}

func (ps *PropertyStore) setProperty(p Property) {
	index := -1
	for i, v := range ps.properties {
		if v.Name == p.Name && v.Source == p.Source {
			index = i
			break
		}
	}
	if index > -1 {
		ps.properties[index] = p
	} else {
		ps.properties = append(ps.properties, p)
	}
}

func (ps *PropertyStore) GetPropertyMap(source string) map[string]Property {
	data := make(map[string]Property)

	for _, v := range ps.properties {
		if v.Source == source {
			data[v.Name] = v
		}
	}

	return data
}

func (ps *PropertyStore) DeleteProperty(name, source string) error {

	// 查找并删除匹配的属性
	index := -1
	for i, prop := range ps.properties {
		if prop.Name == name && prop.Source == source {
			index = i
			break
		}
	}

	if index > -1 {
		ps.properties = append(ps.properties[:index], ps.properties[index+1:]...)
		return ps.saveProperties()
	}

	// 如果没找到匹配的属性，直接返回成功
	return nil
}
