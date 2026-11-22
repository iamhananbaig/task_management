# CLAUDE.md — Task Management

Team task manager for the accounts & finance team. Laravel 13 API + React 19 web app + native Kotlin Android app, one repo. Time zone Asia/Karachi; fiscal year Jul–Jun.

## Structure
```
task_management/
├── backend/     Laravel 13 (PHP 8.4 in Docker), API under /api/v1. Own CLAUDE.md (Laravel Boost rules).
│   ├── app/Services/        WorkflowService (moves), TaskService, RoutineService
│   ├── app/Support/         Audit, Permissions (all permission names + built-in roles), DefaultWorkflow
│   ├── app/Console/Commands tasks:send-due-reminders, tasks:escalate-overdue, routines:create-runs, tasks:create-admin
│   └── routes/console.php   schedule (run by the scheduler container)
├── frontend/    React 19, Vite, Tailwind 4, shadcn base-mira, TanStack Query/Table, dnd-kit
│   └── src/features/        dashboard, tasks (board, list, detail panel), projects (workflow editor),
│                            routines, reports, admin (users, roles, tags, templates, audit), notifications
├── android/     Kotlin, plain Views (mess_soft style). See android/README.md
├── deploy/      DEPLOY.md, backup.sh
└── docker-compose.yml   web (nginx) + app (php-fpm) + scheduler + optional cloudflared, native MySQL via socket
```

## Domain rules (don't break these)
- **Workflow per project**: `project_statuses` (type open/active/review/done) + `project_transitions` (actors: assignee, reviewer, creator, project_manager, any_editor; `requires_comment`, `requires_attachment`). Task status changes ONLY through `WorkflowService::move` (or the "override workflow" permission, still limited to defined moves). Every change writes `task_status_changes` (used by reports).
- **Default cycle**: To do → In progress → Submitted for review → Completed; assignee can pull back from review; reviewer sends back (reason required) or approves; reopen allowed. Attachments are NOT required by default.
- **Due dates are plain dates**, never shifted for weekends/holidays.
- **Routines** (recurring tasks / period-close checklists): a run is created `lead_days` (default 5) before period end; one run per routine per period (unique routine_id + period_end).
- **Escalation**: managers notified once per due date when a task is overdue by the project's `escalate_after_days`.
- **Restricted projects**: visible to members and holders of "view restricted projects". Admin has every permission (RolePermissionSeeder keeps it so).
- **Audit**: `App\Support\Audit::log` / `Auditable` trait, as in ifrs16.
- Notifications: database channel (in-app); manual email reminder (rate-limited 10 min). The Android app polls `/notifications` every 15 min (WorkManager); no FCM yet. Expo push code is kept but off (`EXPO_PUSH_ENABLED=false`).

## Commands
| | |
|---|---|
| Backend dev | `cd backend && php artisan serve --port=8001` (8000 is used by ifrs16 locally) |
| Backend tests | `cd backend && php artisan test --compact`; format `vendor/bin/pint --dirty --format agent` |
| Demo data | `php artisan migrate:fresh --seed` (users admin/manager/member/viewer@tasks.test, password "password") |
| Frontend dev | `cd frontend && API_PROXY=http://127.0.0.1:8001 npm run dev` (Vite proxies /api) |
| Frontend checks | `npx tsc -b && npx eslint src` — keep both at zero |
| Android | `cd android && JAVA_HOME=/opt/android-studio/jbr ./gradlew assembleDebug` |
| Docker | see deploy/DEPLOY.md (port 127.0.0.1:5054) |

## Conventions
- Frontend house style copied from ifrs16 (components/ui, components/app shell, lib/errors, lib/toast). Component files export only components; no `any`.
- Query retries only on network errors / 5xx (4xx must fail fast).
- Never commit `.env`, signing keys or `local.properties`. Commit/push only when asked.
