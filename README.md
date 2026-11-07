# Little Clock

A responsive, browser-based learning clock inspired by a wooden rainbow teaching clock. Built with HTML, CSS, JavaScript, and a scalable SVG face. No build step or JavaScript dependencies.

## Run locally

From this directory, run `python3 -m http.server 4173 --directory dist` and open http://localhost:4173.

You can also open `dist/index.html` directly in a browser. All assets and fonts work offline.

## Publish on GitHub Pages

The repository includes a GitHub Actions workflow in `.github/workflows/pages.yml` that tests the clock and publishes the contents of `dist/`. No build step, dependency installation, or custom secrets are needed.

1. Push this repository, including the workflow, to the `main` branch on GitHub.
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**. The workflow publishes `dist/` directly; there is no branch or folder to select in Pages settings.
4. Open **Actions → Deploy to GitHub Pages → Run workflow**, choose `main`, and run it. This also handles the initial push occurring before Pages was enabled.
5. Once the workflow succeeds, the published URL appears in **Settings → Pages** and in the workflow's deployment environment. For a project repository named `learningclock`, it will normally be `https://<owner>.github.io/learningclock/`.

Every later push to `main` runs the tests and deploys the site automatically. If a test fails, that run stops before deployment. If you rename the branch, update `on.push.branches` in the workflow to match.

The app uses relative asset paths, so it works at a repository URL such as `/learningclock/` as well as at the root of a user site or custom domain.

See [GitHub's Pages publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) for the repository settings.

## Features

- Shows the browser's current local time on load and keeps it up to date.
- Current time button returns to live time.
- Random time button chooses another time for practice.
- A compact, always-visible row lets you enter the hour (1–12) and minute (0–59), with seconds reset to zero. Set time applies the chosen time and pauses the clock for practice; the running switch resumes from that time.
- Click or tap an hour number to set that exact hour (for example, 3 sets 3:00) and pause for practice. Hour numbers also work with Tab, Enter, and Space.
- Separate checkboxes show or hide each hand.
- Optional seconds hand, hidden on the first visit.
- Running/paused button, enabled on the first visit, controls all hands for both current and random times. Resume continues from the paused time; current time resets to the browser's local time.
- Language, hand visibility, running/paused state, and hour-number position are remembered in the browser for the next session.
- English and Traditional Chinese controls. On the first visit, a Chinese browser language chooses Chinese; other languages choose English. An explicit saved choice takes priority on later visits.
- Read time aloud speaks just the displayed time in English or Mandarin Chinese to match the selected language, without an introductory phrase. It includes seconds when the seconds hand is enabled and reads paused/random times as displayed. Uses the browser's speech synthesis and available device voices.
- Voice selection prefers voices named Premium, Natural, Neural, Enhanced, or Google when available, at the voice's normal speed and pitch. A Voice selector lets you choose separately for English and Chinese, with both choices remembered. Available voices refresh when the browser loads them; Cantonese voices are excluded from Mandarin reading.
- Hour numbers can sit at the start or middle of each colored section; this preference is also saved locally.
- Minute hand movement defaults to Jumps (exact minute marks, advancing at second zero), with a saved Smooth option alongside the hour-number setting.
- 12-hour face, an inner ring of dots, all 60 minutes, and colored five-minute markers.
- Correct hand positions, with the hour hand moving gradually and the minute hand following the chosen movement setting. No digital answer.
- Phone and tablet layouts with a full-width clock, 44–48px touch targets, readable native selectors, and safe-area spacing. Portrait controls reflow to fit narrow screens; short landscape screens place the clock beside the controls. Browser zoom remains available.
- Desktop windows at least 960px wide place the same compact controls to the right of the clock; the clock scales with window height to keep the controls in view.

The browser app is in `dist/`; no build step is required.

## Verify

Run `node --test tests/clock.test.cjs`. The checks cover every minute on the clock face, live/practice behavior, custom time entry, and language switching.

Responsive browser checks cover 320×568, 390×844, 430×932, 768×1024, 844×390, and 1280×800 viewports, including English and Traditional Chinese labels. Verify native speech voices separately on the target device.
