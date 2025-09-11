package main

import (
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
	http.HandleFunc("/api/admin", handleAdmin)
	http.HandleFunc("/api/envgroup", handleEnvGroup)
	http.HandleFunc("/api/envgroupswitch", handleEnvGroupSwitch)
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

	log.Printf("Environment Manager starting at %s\n", url)
	log.Println("Press Ctrl+C to stop the server")

	// Open browser
	go openBrowser(url)

	// Start server
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
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
