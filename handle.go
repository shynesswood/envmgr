package main

import (
	"encoding/json"
	"log"
	"net/http"
	"syscall"
)

// 设置首页
func serveIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "static/index.html")
}

// 处理环境变量
func handleEnvVars(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ps := initPropertyStore()

	switch r.Method {
	case "GET":
		envVars := GetAllEnvVars()

		systemMap := ps.GetPropertyMap("system")
		userMap := ps.GetPropertyMap("user")

		for i, env := range envVars {

			if p, ok := systemMap[env.Name]; ok && env.Source == "system" {
				envVars[i].Remark = p.Remark
			}
			if p, ok := userMap[env.Name]; ok && env.Source == "user" {
				envVars[i].Remark = p.Remark
			}
		}

		if err := json.NewEncoder(w).Encode(envVars); err != nil {
			log.Printf("编码环境变量时出错: %v", err)
			http.Error(w, "Failed to encode environment variables", http.StatusInternalServerError)
			return
		}
	case "POST":
		var req struct {
			Name   string `json:"name"`
			Source string `json:"source"`
			Value  string `json:"value"`
			Remark string `json:"remark"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		switch req.Source {
		case "user":
			/// 写入用户环境变量
			if err := SetUserEnvVar(req.Name, req.Value); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		case "system":
			// 写入系统环境变量
			if err := SetSystemEnvVar(req.Name, req.Value); err != nil {
				if isAccessDenied(err) {
					http.Error(w, "需要管理员权限", http.StatusForbidden)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		// 写入属性信息
		ps.SetProperty(Property{
			Name:   req.Name,
			Source: req.Source,
			Remark: req.Remark,
		})

		w.WriteHeader(http.StatusOK)
	case "DELETE":
		name := r.URL.Query().Get("name")
		source := r.URL.Query().Get("source")
		if name == "" {
			http.Error(w, "Name parameter required", http.StatusBadRequest)
			return
		}
		if source == "" {
			http.Error(w, "Source parameter required", http.StatusBadRequest)
			return
		}

		switch source {
		case "user":
			// 删除用户变量
			if err := DeleteUserEnvVar(name); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		case "system":
			// 删除系统环境变量
			if err := DeleteSystemEnvVar(name); err != nil {
				if isAccessDenied(err) {
					http.Error(w, "需要管理员权限", http.StatusForbidden)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		// 删除属性信息
		ps.DeleteProperty(name, source)

		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// 管理员状态检查接口
func handleAdmin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	type resp struct {
		IsAdmin bool `json:"isAdmin"`
	}
	_ = json.NewEncoder(w).Encode(resp{IsAdmin: IsAdmin()})
}

// 判定是否权限拒绝（Windows ERROR_ACCESS_DENIED=5）
func isAccessDenied(err error) bool {
	if err == nil {
		return false
	}
	if errno, ok := err.(syscall.Errno); ok {
		return errno == syscall.Errno(5)
	}
	return false
}

// 处理环境变量分组
func handleEnvGroup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	gs := initGroupStore()

	switch r.Method {
	case "GET":
		groups := gs.GetAllGroups()
		if err := json.NewEncoder(w).Encode(groups); err != nil {
			log.Printf("编码环境变量时出错: %v", err)
			http.Error(w, "Failed to encode environment variables", http.StatusInternalServerError)
			return
		}
	case "POST":
		var req Group
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := gs.SetGroup(req); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	case "DELETE":
		name := r.URL.Query().Get("name")
		if name == "" {
			http.Error(w, "Name parameter required", http.StatusBadRequest)
			return
		}
		if err := gs.DeleteGroup(name); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// 处理环境变量分组切换
func handleEnvGroupSwitch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	gs := initGroupStore()
	ps := initPropertyStore()

	switch r.Method {
	case "PUT":
		var req struct {
			GroupName string `json:"groupName"`
			ItemName  string `json:"ItemName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		group, err := gs.GetGroup(req.GroupName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		for i, item := range group.ItemList {
			if item.Name == req.ItemName {
				// 将这个条目编辑为选中
				group.ItemList[i].Selected = true

				// 修改选中的环境变量
				propertyList := make([]Property, 0)
				systemEnvList := make([]EnvVar, 0)
				userEnvList := make([]EnvVar, 0)
				for _, env := range item.EnvList {
					switch env.Source {
					case "system":
						propertyList = append(propertyList, Property{
							Name:   env.Name,
							Source: env.Source,
							Remark: env.Remark,
						})
						systemEnvList = append(systemEnvList, env)
					case "user":
						propertyList = append(propertyList, Property{
							Name:   env.Name,
							Source: env.Source,
							Remark: env.Remark,
						})
						userEnvList = append(userEnvList, env)
					}
				}
				if err := BatchSetSystemEnvVar(systemEnvList); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				if err := BatchSetUserEnvVar(userEnvList); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				ps.BatchSetProperty(propertyList)
			} else {
				group.ItemList[i].Selected = false
			}
		}

		if err := gs.SetGroup(group); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
