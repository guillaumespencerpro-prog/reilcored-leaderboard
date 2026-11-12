# REILCORED — Live leaderboard

Keeps one message in `#🏆⟩leaderboard` up to date with the top 10 of the DraftBot XP system.

- `leaderboard.mjs` reads the public page https://www.draftbot.fr/levels/1358558675660181524 and edits the message through a Discord webhook.
- `.github/workflows/leaderboard.yml` runs it every 10 minutes on GitHub Actions (free).
- `message_id.txt` is created automatically after the first post. Delete it to post a brand-new message.

## Setup

1. Repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: `WEBHOOK_URL`
   - Value: the webhook URL of `#🏆⟩leaderboard`
2. Actions tab → "Live leaderboard" → Run workflow.

## Notes

- GitHub pauses scheduled workflows after 60 days without activity in the repository. If that happens, click "Enable workflow" in the Actions tab.
- If DraftBot changes its leaderboard page, the run fails with a clear error and the last message stays as it was.
- Test offline with `node test/test.mjs`.

by reilcored — Genève, Suisse
