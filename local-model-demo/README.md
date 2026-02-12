# Local Model React Native Demo

This is a React Native (Expo) demo application that demonstrates how to connect to a local LLM server.

## Prerequisites

1.  **Node.js**: Installed (v18+ recommended).
2.  **Local Model Server**: You must have the Python server running.
    *   See `../thirdparty/my-local-model/README.md` for instructions.
    *   Or follow the in-app setup guide.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the App**:
    *   **iOS Simulator**:
        ```bash
        npm run ios
        ```
    *   **Android Emulator**:
        ```bash
        npm run android
        ```
    *   **Web**:
        ```bash
        npm run web
        ```

## Connection Details

*   **Android Emulator**: Connects to `http://10.0.2.2:8000` (which maps to the host's localhost).
*   **iOS Simulator**: Connects to `http://localhost:8000`.
*   **Physical Device**: You will need to change `src/api/client.js` to point to your computer's local IP address (e.g., `http://192.168.1.x:8000`).

## Troubleshooting

*   **Network Error**: Ensure the Python server is running.
*   **Expo Error**: Try clearing cache with `npx expo start -c`.
