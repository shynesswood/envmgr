package main

import (
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

type EnvVar struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Source string `json:"source"` // "system" or "user"
	Remark string `json:"remark"`
}

// 获取系统及当前用户的环境变量
func GetAllEnvVars() []EnvVar {

	result := make([]EnvVar, 0)

	// 系统环境变量
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE,
		`SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.READ); err == nil {
		defer k.Close()
		if names, err := k.ReadValueNames(0); err == nil {
			for _, n := range names {
				if v, _, err := k.GetStringValue(n); err == nil {
					result = append(result, EnvVar{
						Name:   n,
						Value:  v,
						Source: "system",
					})
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
					result = append(result, EnvVar{
						Name:   n,
						Value:  v,
						Source: "user",
					})
				}
			}
		}
	}

	return result
}

// 更新用户环境变量
func SetUserEnvVar(name, value string) error {
	if err := setUserEnvVar(name, value); err != nil {
		return err
	}
	return broadcastChange()
}

// 批量更新用户环境变量
func BatchSetUserEnvVar(envs []EnvVar) error {
	for _, env := range envs {
		if err := setUserEnvVar(env.Name, env.Value); err != nil {
			return err
		}
	}
	return broadcastChange()
}

func setUserEnvVar(name, value string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.SetStringValue(name, value); err != nil {
		return err
	}
	return nil
}

// 删除用户环境变量
func DeleteUserEnvVar(name string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.DeleteValue(name); err != nil {
		if serr, ok := err.(*syscall.Errno); ok {
			if *serr == syscall.ENOENT {
				// 检查错误是否是 "文件未找到" (ERROR_FILE_NOT_FOUND)
				// 如果是，则认为操作成功，因为环境变量本身就不存在或已被成功删除。
				return broadcastChange()
			}
		}
		return err
	}
	return broadcastChange()
}

// 更新系统环境变量
func SetSystemEnvVar(name, value string) error {
	if err := setSystemEnvVar(name, value); err != nil {
		return err
	}
	return broadcastChange()
}

// 批量更新系统环境变量
func BatchSetSystemEnvVar(envs []EnvVar) error {
	if len(envs) == 0 {
		return nil
	}
	for _, env := range envs {
		if err := setSystemEnvVar(env.Name, env.Value); err != nil {
			return err
		}
	}
	return broadcastChange()
}

func setSystemEnvVar(name, value string) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.SetStringValue(name, value); err != nil {
		return err
	}
	return nil
}

// 删除系统环境变量
func DeleteSystemEnvVar(name string) error {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.DeleteValue(name); err != nil {
		if serr, ok := err.(*syscall.Errno); ok {
			if *serr == syscall.ENOENT {
				// 检查错误是否是 "文件未找到" (ERROR_FILE_NOT_FOUND)
				// 如果是，则认为操作成功，因为环境变量本身就不存在或已被成功删除。
				return broadcastChange()
			}
		}
		return err
	}
	return broadcastChange()
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

// IsAdmin 尝试以写权限打开系统环境变量注册表分支来判断是否具备管理员权限
func IsAdmin() bool {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	if err == nil {
		k.Close()
		return true
	}
	return false
}
