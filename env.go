package main

import (
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

type EnvVar struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	Source  string `json:"source"` // "system" or "user"
	Comment string `json:"comment"`
}

func GetAllEnvVars() []EnvVar {
	systemVars := map[string]string{}
	userVars := map[string]string{}

	// 系统环境变量
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE,
		`SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.READ); err == nil {
		defer k.Close()
		if names, err := k.ReadValueNames(0); err == nil {
			for _, n := range names {
				if v, _, err := k.GetStringValue(n); err == nil {
					systemVars[n] = v
				}
			}
		}
	}

	// 用户环境变量
	if k, err := registry.OpenKey(registry.CURRENT_USER,
		`Environment`, registry.READ); err == nil {
		defer k.Close()
		if names, err := k.ReadValueNames(0); err == nil {
			for _, n := range names {
				if v, _, err := k.GetStringValue(n); err == nil {
					userVars[n] = v
				}
			}
		}
	}

	// 先加载所有备注，如果文件不存在或出错也不会影响环境变量的显示
	comments := GetAllEnvVarComments()
	if comments == nil {
		comments = make(map[string]string)
	}

	// 合并结果，确保所有环境变量都能显示（备注可以为空）
	result := make([]EnvVar, 0)
	addedVars := make(map[string]bool) // 用于避免重复添加

	// 添加系统变量
	for name, value := range systemVars {
		// 检查是否有同名的用户变量，如果有，优先使用用户变量
		if userValue, userExists := userVars[name]; userExists {
			result = append(result, EnvVar{
				Name:    name,
				Value:   userValue,
				Source:  "user",
				Comment: comments[name], // 备注可能为空，这没问题
			})
		} else {
			result = append(result, EnvVar{
				Name:    name,
				Value:   value,
				Source:  "system",
				Comment: comments[name], // 备注可能为空，这没问题
			})
		}
		addedVars[name] = true
	}

	// 添加仅存在于用户环境中的变量
	for name, value := range userVars {
		if !addedVars[name] {
			result = append(result, EnvVar{
				Name:    name,
				Value:   value,
				Source:  "user",
				Comment: comments[name], // 备注可能为空，这没问题
			})
		}
	}

	return result
}

func SetUserEnvVar(name, value string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.SetStringValue(name, value); err != nil {
		return err
	}
	return broadcastChange()
}

func DeleteUserEnvVar(name string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.DeleteValue(name); err != nil {
		return err
	}
	return broadcastChange()
}

// EnvVarsToMap 将新的EnvVar结构转换为旧的map格式，用于向后兼容
func EnvVarsToMap(envVars []EnvVar) map[string]string {
	result := make(map[string]string)
	for _, envVar := range envVars {
		result[envVar.Name] = envVar.Value
	}
	return result
}

func broadcastChange() error {
	user32 := syscall.NewLazyDLL("user32.dll")
	sendMessageTimeout := user32.NewProc("SendMessageTimeoutW")
	const HWND_BROADCAST = 0xFFFF
	const WM_SETTINGCHANGE = 0x001A
	const SMTO_ABORTIFHUNG = 0x0002

	ptr, _ := syscall.UTF16PtrFromString("Environment")
	ret, _, err := sendMessageTimeout.Call(
		uintptr(HWND_BROADCAST),
		uintptr(WM_SETTINGCHANGE),
		0,
		uintptr(unsafe.Pointer(ptr)),
		uintptr(SMTO_ABORTIFHUNG),
		5000,
		0,
	)
	if ret == 0 {
		return fmt.Errorf("SendMessageTimeout failed: %v", err)
	}
	return nil
}
