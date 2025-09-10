# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Windows environment variable manager built with Go and the Fyne GUI framework. It provides a graphical interface for managing system and user environment variables, with support for saving and loading environment profiles.

## Common Commands

### Building and Running
```bash
# Build the application
go build -o envmgr.exe

# Run the application
go run .
```

### Testing
```bash
# Run all tests
go test ./...

# Run tests with verbose output
go test -v ./...
```

## Architecture

### Core Components

1. **main.go** - GUI application entry point using Fyne framework
   - Implements the main window with a table view of environment variables
   - Handles user interactions (add, edit, delete variables)
   - Manages profile operations (save, load)
   - Uses global variables for state management

2. **env.go** - Windows registry operations
   - `GetAllEnvVars()` - reads from both HKLM\System and HKCU\Environment registry keys
   - `SetUserEnvVar()` - writes to HKCU\Environment registry key
   - `DeleteUserEnvVar()` - removes from HKCU\Environment registry key
   - `broadcastChange()` - notifies system of environment changes via Win32 API

3. **profile.go** - Environment profile management
   - Stores profiles as JSON in %APPDATA%/envmgr_profiles.json
   - `Profile` struct contains name and variables map
   - `ApplyProfile()` applies all variables from a saved profile

### Key Technical Details

- **Windows-specific**: Uses `golang.org/x/sys/windows/registry` for direct registry access
- **GUI Framework**: Fyne v2 for cross-platform GUI (currently Windows-focused)
- **State Management**: Global variables store current environment state and UI references
- **Profile Storage**: JSON files in user's AppData directory
- **System Integration**: Broadcasts WM_SETTINGCHANGE messages to notify other applications

### Dependencies

- `fyne.io/fyne/v2` - GUI framework
- `golang.org/x/sys/windows/registry` - Windows registry access
- Standard library packages for JSON, file operations, and system calls

### Windows Integration

The application directly manipulates the Windows registry and uses the Win32 API (`SendMessageTimeoutW`) to broadcast environment variable changes to the system, ensuring other applications receive notifications about environment updates.