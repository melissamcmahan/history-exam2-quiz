# Exam 2 Study App

A flashcard + quiz app covering US History Exam 2 (WWI through WWII, chapters 23–27) — built from the class study guide, with every identification, person, and event/term turned into a flashcard and a multiple-choice quiz question.

- **112 cards** across 9 categories (Identifications, People, WWI, The 1920s, Depression & New Deal, Path to WWII, WWII Pacific, WWII Europe, Home Front)
- **Flashcard mode** — flip cards, mark "I know this" / "still learning," filter by category, review only what you haven't mastered yet
- **Quiz mode** — multiple choice, randomized, pulls plausible wrong answers from the same era so it's not too easy; review missed questions and retry just those
- Progress is saved on-device (localStorage) — no account, no server, no data collected
- **Installable as an app** on a phone home screen (it's a Progressive Web App) and works offline once installed

## Install on a phone

1. Open the live site link in **Safari** (iPhone) or **Chrome** (Android).
2. iPhone: tap the Share icon → **Add to Home Screen**.
   Android: tap the ⋮ menu → **Add to Home Screen** / **Install App**.
3. Open it from the home screen icon like any other app.

## Running locally

No build step — it's plain HTML/CSS/JS. Just serve the folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
