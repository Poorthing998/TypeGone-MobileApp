# TypeGone Mobile App

TypeGone Mobile is a React Native (Expo) and native Android keyboard application that provides intelligent AI-powered voice-to-text functionality directly from your keyboard. By integrating deeply with Android's `InputMethodService` and Supabase Edge Functions, TypeGone records your voice, processes it with specific AI prompts (like "Tidy Speech", "Summarize", or "Translate"), and injects the polished text directly into any text field across your device.

## Core Features

- **Custom Native Android Keyboard**: A fully functional custom keyboard built in Kotlin, allowing seamless typing and voice recording within any app.
- **AI Voice Modes**: Apply custom prompts to your speech before it's inserted. Default modes include:
  - *Tidy Speech*: Cleans up filler words and fixes grammar.
  - *Write Email*: Formats spoken text into a professional email.
  - *AI Prompt*: Structures speech for optimal LLM generation.
  - *Summarize*: Condenses speech into bullet points.
  - *Translate to EN*: Translates any spoken language to English.
- **Multi-Language Support**: Supports multiple keyboard layouts including English (QWERTY), Persian, Arabic, Spanish, French, German, Russian, and Portuguese. Quickly switch languages by swiping on the spacebar.
- **Dynamic Theming**: Light and dark themes that sync between the main app and the keyboard.
- **Supabase Authentication**: Secure user management and login syncing across the React Native app and the native keyboard extension.
- **In-App Updater**: Automatically checks for new versions via a hosted `version.json` and prompts users to update seamlessly.

## Tech Stack

### Frontend & App Shell
- **React Native** & **Expo** (v54): Core app framework.
- **React Navigation**: For screen transitions and routing.
- **TypeScript**: Ensuring type safety across the frontend.

### Backend & Cloud Services
- **Supabase**: Used for Authentication, User Profiles, and Edge Functions.
- **Edge Functions**: The `process-recording` function receives the audio file and prompt, transcribes it, applies the AI transformation, and returns the result.

### Native Android Subsystem
- **Kotlin**: Core language for the custom keyboard.
- **InputMethodService**: Android API used to render the keyboard and inject text.
- **MediaRecorder**: Handles on-device voice capturing.
- **OkHttp3**: Handles audio uploads and token refreshing directly from the keyboard service to Supabase.

## Project Structure

```text
TypeGoneMobile/
│
├── App.tsx                     # Main app entry and Navigation Stack
├── app.json                    # Expo configuration
├── package.json                # JS dependencies
│
├── android/
│   ├── app/src/main/java/com/typegone/mobile/
│   │   ├── TypeGoneKeyboard.kt       # Native Keyboard core logic
│   │   └── TypeGoneKeyboardView.kt   # Native Keyboard drawing logic (Hints, swipes)
│   └── app/src/main/res/             # Native layouts, strings, and keyboard XML files
│
├── src/
│   ├── components/
│   │   └── UpdateChecker.tsx         # In-App update modal
│   ├── context/
│   │   └── AuthContext.tsx           # Supabase Auth Provider
│   ├── lib/
│   │   └── supabase.ts               # Supabase client instantiation and default Voice Modes
│   └── screens/
│       ├── HomeScreen.tsx            # Main dashboard indicating active status
│       ├── ModesScreen.tsx           # Voice modes management
│       ├── PaymentScreen.tsx         # Payments/Credits screen
│       └── SettingsScreen.tsx        # Themes, Languages, and general settings
```

## How It Works (The Voice Flow)

1. The user selects a text field in any app, triggering the **TypeGone Keyboard**.
2. They tap the **MIC** button to start speaking. `MediaRecorder` captures the audio.
3. Upon releasing, the keyboard authenticates using synced Supabase tokens.
4. The `.m4a` file and the selected **AI Prompt** are base64 encoded and sent to the Supabase Edge Function (`process-recording`).
5. The Edge Function processes the audio and returns the final transformed string.
6. The keyboard receives the response and uses `InputConnection.commitText()` to insert it directly into the user's active text field.

## Getting Started

### Prerequisites

- Node.js & npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for native keyboard builds and testing)

### Installation

1. Clone the repository and install JS dependencies:
   ```bash
   npm install
   ```

2. Start the Metro bundler:
   ```bash
   npx expo start
   ```

3. **Building for Android** (Since this relies on custom Native code, you cannot use Expo Go):
   ```bash
   npx expo run:android
   ```
   Or open the `android` folder in Android Studio and build from there.

## Enabling the Keyboard

After installing the app on an Android device:
1. Open the **TypeGone app** and sign in.
2. Go to your Android device **Settings** > **System** > **Languages & input** > **On-screen keyboard** > **Manage on-screen keyboards**.
3. Toggle on **TypeGone**.
4. Set it as your default keyboard.
