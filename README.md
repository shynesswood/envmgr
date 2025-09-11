# 环境变量管理器 (Windows)

一个基于 Go + 原生前端的轻量级环境变量可视化管理工具，支持查看、添加、编辑、删除系统/用户环境变量，并提供“环境分组/一键切换”能力。适用于 Windows 10/11。

## 功能特性
- 环境变量
  - 列表展示系统/用户环境变量（带来源标识）
  - 添加/编辑/删除变量（支持备注）；变量值为多行文本，适合长字符串
  - 防抖与按钮加载态，避免重复提交；加载/错误提示友好
  - 非管理员账号自动禁用“系统变量”写入；后端权限不足返回 403 并提示
- 环境分组
  - 新建/编辑分组，分组包含多个条目，每个条目包含若干环境变量
  - 条目支持备注；条目内变量支持来源(用户/系统)、值、备注
  - 分组详情展示“默认选中”状态；分组列表也展示已选中条目
  - 切换环境：选择分组条目后，批量写入对应的系统/用户环境变量
  - 存在“脏数据”（多个选中条目）时仍允许切换，并以新选择纠正
- 备注体系
  - 变量备注持久化至 `env_property.json`，不影响真实环境变量
  - 分组持久化至 `env_group.json`

## 环境要求
- 系统：Windows 10/11（依赖 Windows 注册表）
- Go：1.20+
- 浏览器：Edge/Chrome 等现代浏览器

## 快速开始
```bash
# 运行（开发模式）
go run .

# 或编译
go build -o envmgr.exe
./envmgr.exe
```
程序会从 8080 起寻找可用端口并打开浏览器。

## 目录结构
```
.
├─ main.go                 # 入口；注册路由、挑选端口、打开浏览器
├─ handle.go               # HTTP 接口：变量 CRUD、分组 CRUD、管理员检查、分组切换
├─ env.go                  # Windows 注册表读写、系统/用户变量更新与广播
├─ property.go             # 变量备注持久化 (env_property.json)
├─ group.go                # 分组持久化 (env_group.json)
├─ static/
│  ├─ index.html           # 页面骨架与样式
│  └─ js/app.js            # 前端逻辑 (EnvironmentManager)
├─ env_property.json       # 运行时生成
├─ env_group.json          # 运行时生成
└─ README.md
```

## 使用说明
### 顶部菜单
- 环境变量：展示/管理系统与用户环境变量（包含“用户变量/系统变量”Tab）
- 环境分组：分组管理与一键切换（隐藏变量 Tab）

### 环境变量页面
- 添加/编辑：变量名、变量值(多行)、来源(用户/系统)、备注
- 非管理员：系统变量来源被禁用；若强制提交，后端返回 403 并提示
- 删除：单条删除，完成后自动刷新

### 环境分组页面
- 新建/编辑分组：
  - 分组由多个“条目”组成，每个条目包含变量列表（名称/值/来源/备注）
  - 非管理员：条目内变量的“系统”来源选项禁用或回退为“用户”
  - 变量列表区域支持滚动，底部按钮始终可点
- 查看详情：
  - 顶部摘要显示“默认选中条目”；条目卡片右侧显示“默认选中/未选中”徽标
- 切换环境：
  - 打开“切换”选择条目后，批量写入对应变量（系统/用户）
  - 若多个条目被标记为选中，则默认选中第一个；仍允许切换以纠正

## 管理员与权限
- 写入/删除系统环境变量需要管理员权限
- 运行建议：右键以管理员身份运行，或以管理员终端启动
- 常见响应：403（需要管理员权限）、500（内部错误）

## 简要接口
- GET `/api/env` → `[]EnvVar`
- POST `/api/env` → `{name,value,source,remark}`
- DELETE `/api/env?name=...&source=user|system`
- GET `/api/admin` → `{isAdmin: boolean}`
- GET `/api/envgroup` / POST `/api/envgroup` / DELETE `/api/envgroup?name=...`
- PUT `/api/envgroupswitch` → `{groupName, ItemName}`

## 数据模型（节选）
```go
// env.go
type EnvVar struct {
  Name   string `json:"name"`
  Value  string `json:"value"`
  Source string `json:"source"` // "system" | "user"
  Remark string `json:"remark"`
}

// group.go
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
```

## FAQ
- 写系统变量失败/403：请以管理员身份运行
- 端口被占用：程序会从 8080 连续尝试 10 个端口
- 变量值很长：添加/编辑已使用多行文本框，支持手动拉伸

## 许可证
MIT
