package main

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
)

type Profile struct {
    Name string            `json:"name"`
    Vars map[string]string `json:"vars"`
}

func profileFile() string {
    appdata := os.Getenv("APPDATA")
    return filepath.Join(appdata, "envmgr_profiles.json")
}

func LoadProfiles() ([]Profile, error) {
    file := profileFile()
    data, err := os.ReadFile(file)
    if os.IsNotExist(err) {
        return []Profile{}, nil
    }
    if err != nil {
        return nil, err
    }
    var profiles []Profile
    if err := json.Unmarshal(data, &profiles); err != nil {
        return nil, err
    }
    return profiles, nil
}

func SaveProfile(name string, vars map[string]string) error {
    profiles, _ := LoadProfiles()
    p := Profile{Name: name, Vars: vars}
    profiles = append(profiles, p)
    data, err := json.MarshalIndent(profiles, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(profileFile(), data, 0644)
}

func ApplyProfile(name string) error {
    profiles, err := LoadProfiles()
    if err != nil {
        return err
    }
    for _, p := range profiles {
        if p.Name == name {
            for k, v := range p.Vars {
                if err := SetUserEnvVar(k, v); err != nil {
                    return err
                }
            }
            return nil
        }
    }
    return fmt.Errorf("Profile %s not found", name)
}
