# Local Model Manager (macOS) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate a "Model Manager" into the macOS demo app to handle dependencies, model download, and server lifecycle directly from the UI.

**Architecture:**
- **Native Module**: Create a local React Native package (`react-native-cmd-run`) to expose `NSTask` for shell command execution.
- **Entitlements**: Disable App Sandbox to allow executing external scripts (python/pip) freely.
- **UI**: Add a `ManagerScreen` with status indicators and action buttons.
- **State Management**: Track server status (running/stopped), installation status, and download progress.

**Tech Stack:** React Native macOS, Objective-C (Native Module), CocoaPods.

---

### Task 1: Create Native Command Runner Module

**Files:**
- Create: `packages/react-native-cmd-run/package.json`
- Create: `packages/react-native-cmd-run/react-native-cmd-run.podspec`
- Create: `packages/react-native-cmd-run/macos/CmdRun.h`
- Create: `packages/react-native-cmd-run/macos/CmdRun.m`
- Create: `packages/react-native-cmd-run/index.js`

**Step 1: Define Package**
Create a local package that can be installed via npm/CocoaPods.

`package.json`:
```json
{
  "name": "react-native-cmd-run",
  "version": "1.0.0",
  "main": "index.js",
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  }
}
```

`react-native-cmd-run.podspec`:
```ruby
require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-cmd-run"
  s.version      = package["version"]
  s.summary      = "Run shell commands"
  s.author       = "Trae"
  s.homepage     = "https://github.com/trae-ai"
  s.license      = "MIT"
  s.platforms    = { :macos => "10.15" }
  s.source       = { :git => ".", :tag => "v#{s.version}" }
  s.source_files = "macos/*.{h,m}"
  s.dependency "React-Core"
end
```

**Step 2: Implement Native Module (Obj-C)**
`CmdRun.m`:
- `executeCommand(command, cwd, resolve, reject)`: Runs a command and returns stdout.
- `startServer(command, cwd, resolve, reject)`: Starts a persistent process (simplified for now, maybe just use execute with `&` or separate logic). For now, let's just support running scripts.
- To start the server and keep it running, we might need `NSTask` without waiting for exit, but we need to kill it later.
- Let's add `startProcess(command, args)` and `stopProcess()`.

```objectivec
#import "CmdRun.h"
#import <React/RCTLog.h>

@implementation CmdRun {
    NSTask *_serverTask;
}

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(execute:(NSString *)command
                  withArgs:(NSArray *)args
                  withCwd:(NSString *)cwd
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSTask *task = [[NSTask alloc] init];
    [task setLaunchPath:command];
    [task setArguments:args];
    if (cwd) [task setCurrentDirectoryPath:cwd];

    NSPipe *pipe = [NSPipe pipe];
    [task setStandardOutput:pipe];
    [task setStandardError:pipe];

    NSError *error = nil;
    BOOL success = [task launchAndReturnError:&error];
    
    if (!success) {
        reject(@"launch_error", error.localizedDescription, error);
        return;
    }

    [task waitUntilExit];

    NSData *data = [[pipe fileHandleForReading] readDataToEndOfFile];
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];

    if ([task terminationStatus] == 0) {
        resolve(output);
    } else {
        reject(@"exec_error", output, nil);
    }
}

RCT_EXPORT_METHOD(startServer:(NSString *)command
                  withArgs:(NSArray *)args
                  withCwd:(NSString *)cwd
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (_serverTask && [_serverTask isRunning]) {
        resolve(@"Already running");
        return;
    }

    _serverTask = [[NSTask alloc] init];
    [_serverTask setLaunchPath:command];
    [_serverTask setArguments:args];
    if (cwd) [_serverTask setCurrentDirectoryPath:cwd];

    // Redirect output to stdout/stderr (or pipe if we want to stream logs later)
    // For now, let it inherit or ignore to avoid buffer filling up if we don't read it.
    // Better to pipe to a file or just let it go to system log?
    // Let's just launch it.
    
    NSError *error = nil;
    BOOL success = [_serverTask launchAndReturnError:&error];
    
    if (success) {
        resolve(@"Started");
    } else {
        reject(@"launch_error", error.localizedDescription, error);
    }
}

RCT_EXPORT_METHOD(stopServer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (_serverTask && [_serverTask isRunning]) {
        [_serverTask terminate];
        resolve(@"Stopped");
    } else {
        resolve(@"Not running");
    }
}

@end
```

---

### Task 2: Disable App Sandbox

**Files:**
- Modify: `LocalModelMacOS/macos/LocalModelMacOS-macOS/LocalModelMacOS.entitlements`

**Step 1: Remove Sandbox Entitlement**
Change `com.apple.security.app-sandbox` to `false` (or remove it). This allows `NSTask` to run `python`, `pip`, etc. from the system or user environment.

---

### Task 3: Integrate Native Module

**Files:**
- Modify: `LocalModelMacOS/package.json`
- Modify: `LocalModelMacOS/macos/Podfile`

**Step 1: Install Local Package**
In `LocalModelMacOS`:
`npm install ../packages/react-native-cmd-run`

**Step 2: Update Podfile**
Add `pod 'react-native-cmd-run', :path => '../packages/react-native-cmd-run'` inside the target block if autolinking doesn't catch it (RN > 0.60 should autolink, but local paths sometimes need help or `npm install` + `pod install` is enough).
*Actually, just adding it to package.json is usually enough for autolinking if the path is correct.*

**Step 3: Pod Install**
`cd LocalModelMacOS/macos && pod install`

---

### Task 4: Implement Manager UI

**Files:**
- Create: `LocalModelMacOS/src/screens/ManagerScreen.tsx`
- Modify: `LocalModelMacOS/App.tsx` (Add navigation to Manager)

**Step 1: UI Layout**
- **Section 1: Dependencies**
  - Button: "Install Dependencies" (Runs `pip install ...`)
  - Status: Loading/Success/Error
- **Section 2: Model**
  - Button: "Download Model" (Runs `download_model.py`)
  - Progress: (Maybe just indeterminate spinner for now)
- **Section 3: Server**
  - Button: "Start Server" / "Stop Server"
  - Status: Running/Stopped (Check via health endpoint or process status)
- **Section 4: Test**
  - Button: "Test Connection" (Hits `/v1/models`)

**Step 2: Logic**
Use `CmdRun` to execute the scripts.
*Path Handling*: We need absolute paths to the scripts.
- We can find the project root relative to the app bundle?
- Or just assume we are running from source for this demo?
- *Assumption*: Since this is a dev tool, we will hardcode/find the path to `thirdparty/my-local-model`.
- *Better*: Allow user to pick path? No, keep it simple.
- We know the structure: `project_root/LocalModelMacOS` vs `project_root/thirdparty`.
- So path is `../../thirdparty/my-local-model` relative to `LocalModelMacOS` root.
- The app runs; `cwd` might be `/`.
- We need a way to find the scripts.
- *Hack*: Pass the absolute path. I will use `process.cwd()` from the JS side if available? No, JS runs in the bundle.
- I will search for the path or hardcode a typical dev path for now, or ask the user to input the "Project Root".
- *Refinement*: I will add a TextInput for "Project Root" with a default value of `/Users/litianyi/Documents/__secondlife/__project/myr2d2`.

---

### Task 5: Verify

**Step 1: Build & Run**
`npm run macos`

**Step 2: Test Flow**
1. Click "Install Dependencies".
2. Click "Download Model".
3. Click "Start Server".
4. Go to Chat and verify it works.

