# Design

## Overview
Task Center is implemented but not wired into the Dashboard tab system. The dashboard tab resolver excludes `task-center`, the Dashboard view does not render the Task Center view, and the right-side navigation omits the entry. As a result, a user can end up on a blank middle pane when the tab is set (e.g., via deep link or state), and the right menu no longer offers Task Center navigation. The fix is to restore Task Center as a first-class dashboard tab, wire its store into the Dashboard props, and render the view alongside existing tabs.

## Components
- `packages/app/src/app/app.tsx`: include `task-center` in the dashboard tab resolver, create the Task Center store, and pass its data/actions into `DashboardView` props.
- `packages/app/src/app/pages/dashboard.tsx`: add `TaskCenterView` import, render it in the tab `Switch`, add a title case, and add nav entries (desktop right nav + mobile footer).
- `packages/app/src/app/pages/task-center.tsx`: use existing view component and props (no changes expected).

## Data flow
`createTaskCenterStore` provides items, sync status, and actions. The Dashboard tab `task-center` will pass store slices into `TaskCenterView`. No new APIs are introduced.

## Error handling
Leverage existing store error signal (`error`) and `status` to show the view state. No additional error surfaces are needed.

## Testing
Add a focused unit test to ensure `task-center` is recognized by the dashboard tab resolver and rendered via the Dashboard view switch. This prevents regressions where the tab becomes unreachable or blank.
