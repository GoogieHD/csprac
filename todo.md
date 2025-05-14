# CS2 Practice Queue – Project To-Do

## Completed
- Draft UI synced for all clients
- Session reset
- Final map + server IP display
- **Database integration**
- Login + Register system (including optional admin role)
- Admin Panel (moved to /admin, restricted access)

---

## Live Bugs / Known Issues
- Players can't join the lobby until the session is restarted via admin panel
- Team/map voting breaks if a player leaves during the process (due to less than 10 players, causes state reset and session not correctly saving the user)

---

## Core Features
- Prevent duplicate player names
- Store match data in database
- Restore session state on restart (optional)

---

## UI/UX Improvements
- Show idle animation or waiting screen during queue
- General UI overhaul
---

## Stretch Goals
- Match history page or dashboard
- Discord/Dathost integration (export draft summary)
- Team ready check before match start
