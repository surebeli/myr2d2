# Local Model React Native macOS Demo

This is a **native macOS desktop application** (using `react-native-macos`) that connects to your local LLM server.

## Prerequisites

1.  **Xcode**: You must have Xcode installed to build macOS apps.
2.  **CocoaPods**: Required for dependency management.
3.  **Local Model Server**: Ensure the Python server is running (see `../thirdparty/my-local-model`).

## Setup

1.  **Install JS Dependencies**:
    ```bash
    npm install
    ```

2.  **Install Native Dependencies**:
    Due to network restrictions, the initial setup might have failed to install Pods. You need to run this manually:
    ```bash
    cd macos
    pod install
    cd ..
    ```
    *Note: If you are behind a proxy, ensure your git/terminal proxy settings are correct.*

## Running the App

Once dependencies are installed:

```bash
npm run macos
```

This will launch the Metro bundler and build the native macOS app.

## Features

- **Native macOS UI**: Runs as a desktop app, not in a simulator.
- **Dark Mode Support**: Adapts to system theme.
- **Keyboard Support**: `Enter` to send messages.
- **Local Connection**: Connects directly to `http://localhost:8000`.

## Troubleshooting

- **Pod Install Fails**: Usually due to network issues cloning `DoubleConversion` or `Folly`. Try using a VPN or proxy.
- **Build Fails**: Ensure you have opened `macos/LocalModelMacOS.xcworkspace` in Xcode at least once to verify signing/teams if needed (though usually not required for local debug builds).
