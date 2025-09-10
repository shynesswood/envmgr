package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"
)

func main() {
	// Start web server
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/api/env", handleEnvVars)
	http.HandleFunc("/api/comments", handleComments)
	http.HandleFunc("/api/comments/save", handleSaveComment)
	http.HandleFunc("/api/profiles", handleProfiles)
	http.HandleFunc("/api/profile/save", handleSaveProfile)
	http.HandleFunc("/api/profile/apply", handleApplyProfile)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Find available port
	port := 8080
	for i := 0; i < 10; i++ {
		if isPortAvailable(port) {
			break
		}
		port++
	}

	url := fmt.Sprintf("http://localhost:%d", port)

	fmt.Printf("Environment Manager starting at %s\n", url)
	fmt.Println("Press Ctrl+C to stop the server")

	// Open browser
	go openBrowser(url)

	// Start server
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}

func serveIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "static/index.html")
}

func handleEnvVars(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		log.Println("开始加载环境变量...")
		envVars := GetAllEnvVars()
		log.Printf("成功加载 %d 个环境变量", len(envVars))

		if err := json.NewEncoder(w).Encode(envVars); err != nil {
			log.Printf("编码环境变量时出错: %v", err)
			http.Error(w, "Failed to encode environment variables", http.StatusInternalServerError)
			return
		}
	case "POST":
		var req struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := SetUserEnvVar(req.Name, req.Value); err != nil {
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
		if err := DeleteUserEnvVar(name); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleProfiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	profiles, err := LoadProfiles()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(profiles)
}

func handleSaveProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name string            `json:"name"`
		Vars map[string]string `json:"vars"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := SaveProfile(req.Name, req.Vars); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleApplyProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := ApplyProfile(req.Name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleComments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	comments := GetAllEnvVarComments()
	json.NewEncoder(w).Encode(comments)
}

func handleSaveComment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name    string `json:"name"`
		Comment string `json:"comment"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := SetEnvVarComment(req.Name, req.Comment); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func isPortAvailable(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

func openBrowser(url string) {
	time.Sleep(500 * time.Millisecond) // Give server time to start

	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start"}
	case "darwin":
		cmd = "open"
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}

	args = append(args, url)
	exec.Command(cmd, args...).Start()
}
