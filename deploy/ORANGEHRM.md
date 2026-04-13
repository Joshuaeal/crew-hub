# HR in Crew Hub (replaces OrangeHRM stack)

OrangeHRM is **no longer part of the default Docker stack**. People and leave workflows run **inside Crew Hub**:

- **Directory** — `/hr/directory` (crew accounts from `.data/users.json`)
- **Leave** — `/hr/leave` — requests stored in `.data/leave-requests.json`

Grant **`hr`** to members who should see HR, **`hr_manage`** (or **`users_manage`**) to approve leave. See **Users & permissions** in the admin panel.

If you still self-host OrangeHRM elsewhere, link it from your runbook; the hub does not configure it automatically.
