/**
 * The short "?" note on each screen: what the screen is for and the usual steps.
 * Keyed by route pattern.
 */
const notes: Record<string, string[]> = {
  "/": [
    "Your open tasks in every project: what is overdue, due today and in the next 7 days, and what waits for your review.",
    "Click a figure to see those tasks. Press Ctrl+K anywhere to find a task (by title or number, e.g. WEB-12) or a project.",
  ],
  "/my-tasks": [
    "Assigned to me: your open tasks, soonest due first. Use the chips to narrow by due date.",
    "To review: tasks in a review status where you are the reviewer — open one and Approve or Send back.",
  ],
  "/projects": ["Projects you belong to (managers and admins see all). Press N for a new project."],
  "/projects/:id": [
    "Board: one column per status. Drag a card to another column to move it — only moves the workflow allows you are possible; others are dimmed. Some moves ask for a comment.",
    "Drag within a column to change the order. On a phone, press and hold a card to drag it.",
    "List: every task including older completed ones, sortable. Press N for a new task.",
    "Open a task to change its people, dates and checklist, comment, attach files or email a reminder.",
  ],
  "/projects/:id/settings": [
    "Details: name, key (task numbers), colour; archive makes the project read-only.",
    "Members: who sees the project and can be assignee / reviewer. Managers also change these settings.",
    "Workflow: the statuses (columns) and the moves between them, with who may make each move and whether a comment is required.",
  ],
  "/projects/:id/routines": [
    "A routine is work that repeats every period: one recurring task, or a whole close checklist.",
    "Its tasks are created automatically a few days before the period ends (set per routine); Start … now creates them early.",
    "Open a routine to change its tasks; changes apply to future periods only.",
  ],
  "/projects/:id/routines/:routineId": [
    "Tasks in each run: title, people, priority, tags, checklist and when it is due — counted in calendar days from the period end.",
    "Monthly = calendar months; quarterly, half-yearly and yearly follow the Jul–Jun fiscal year.",
    "Pause a routine to stop new runs without deleting it.",
  ],
  "/runs/:id": ["One period of a routine: how much is done, in review and overdue, and every task in it."],
  "/reports": [
    "On time: tasks due in the range — done by their due date, done late, or still open past due. The % is on time out of those decided.",
    "Review time: how long tasks waited in a review status before the reviewer approved or sent them back.",
    "Overdue: open overdue tasks at each month end. Periods: each routine run in the range.",
    "Filter by project, tag or person; Export downloads the tables to Excel.",
  ],
  "/tags": ["Groups like Entity, Branch or Cost centre. A task takes one tag per group; inactive tags stay on old tasks."],
  "/notifications": ["Assignments, workflow moves, comments and due-date reminders. The same notices are pushed to the phone app."],
  "/bin": ["Deleted tasks. Restore puts a task back in its project and status."],
  "/users": ["Create accounts and reset passwords. Deactivated users cannot sign in; their tasks and history stay."],
  "/roles": ["Tick what each role may do. Changes apply at once to everyone with that role."],
  "/workflow-templates": ["Workflows new projects can start from. Save one from a project's Settings → Workflow."],
  "/audit-log": ["Every change with who made it and when. Click a record to open it."],
}

function matches(pattern: string, pathname: string): boolean {
  const a = pattern.split("/")
  const b = pathname.split("/")
  return a.length === b.length && a.every((part, i) => part.startsWith(":") || part === b[i])
}

export function helpFor(pathname: string): string[] | undefined {
  const key = Object.keys(notes).find((pattern) => matches(pattern, pathname))
  return key ? notes[key] : undefined
}
