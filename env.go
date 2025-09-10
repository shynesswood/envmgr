package main

import (
    "fmt"
    "golang.org/x/sys/windows/registry"
    "syscall"
    "unsafe"
)

type EnvVar struct {
    Name   string `json:"name"`
    Value  string `json:"value"`
    Source string `json:"source"` // "system" or "user"
}

func GetAllEnvVars() []EnvVar {
    systemVars := map[string]string{}
    userVars := map[string]string{}

    // 系统环境变量
    if k, err := registry.OpenKey(registry.LOCAL_MACHINE,
        `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.READ); err == nil {
        defer k.Close()
        names, _ := k.ReadValueNames(0)
        for _, n := range names {
            if v, _, err := k.GetStringValue(n); err == nil {
                systemVars[n] = v
            }
        }
    }

    // 用户环境变量
    if k, err := registry.OpenKey(registry.CURRENT_USER,
        `Environment`, registry.READ); err == nil {
        defer k.Close()
        names, _ := k.ReadValueNames(0)
        for _, n := range names {
            if v, _, err := k.GetStringValue(n); err == nil {
                userVars[n] = v
            }
        }
    }

    // 合并结果，用户变量优先（覆盖系统变量）
    result := make([]EnvVar, 0)
    
    // 添加系统变量
    for name, value := range systemVars {
        source := "system"
        if _, exists := userVars[name]; exists {
            source = "user" // 如果用户也有同名变量，标记为用户变量
        }
        result = append(result, EnvVar{Name: name, Value: value, Source: source})
    }
    
    // 添加仅用户的变量
    for name, value := range userVars {
        if _, exists := systemVars[name]; !exists {
            result = append(result, EnvVar{Name: name, Value: value, Source: "user"})
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
