# System Settings — UI API Testing

This document explains how to test the **System Settings** modules that are now wired to the backend (ERP-Raigine routes) through the UI.

## Prerequisites

1. Set the API base URL in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

2. Ensure you are logged in (or have a valid auth cookie):

- The frontend reads the `Authorization` cookie and sends it as `Authorization: Bearer <token>` for these endpoints.

## How the integration works

- If `NEXT_PUBLIC_API_URL` is **not set** (or is literally `"undefined"`), the UI keeps the existing **mock behavior** (shows success messages and navigates back).
- If `NEXT_PUBLIC_API_URL` **is set**, the UI will call the backend via RTK Query mutations.

All System Settings endpoints are defined in:

- [src/lib/api/system-settings/api.ts](../src/lib/api/system-settings/api.ts)

If your backend route prefixes differ, update the `ROUTES` constants in that file.

ERP-raigine System Settings uses `/api/...` paths (the frontend includes `/api` in each endpoint URL).

## Modules & what to click

All create screens are under:

- `/system-settings` (hub)
- then press **Add/Create** for the relevant module

### UoM (Global)

UI path:
- System Settings → **UoM Global** → Add

API call when enabled:
- `POST /api/uom-parameters`

Payload (sent as snake_case):
- `code`, `name`, `category`

Notes:
- Backend forces `status = "Active"` on create.

### Type Parameters

UI path:
- System Settings → **Type Parameters** → Add

API call:
- `POST /api/type-parameters`

Payload:
- `type_code`, `type_name`, `description`

Notes:
- Backend forces `status = "Active"` on create.

### Global — Working Days

UI path:
- System Settings → **Global (Working Days)** → Add

API call:
- `POST /api/global-parameters`

Payload:
- `period`, `working_days`

Notes:
- Backend forces `parameter_group = "Working Days"` and `status = "Active"`.

### Kanban — FG Standards

UI path:
- System Settings → **Kanban** → Add

API call:
- `POST /api/kanban-parameters`

Payload:
- `item_uniq_code`, `item_name`, `kanban_qty`, `min_stock`, `max_stock`

Notes:
- Backend forces `status = "Active"` on create.

### Process

UI path:
- System Settings → **Process** → Add

API call:
- `POST /api/process-parameters`

Payload:
- `process_code`, `process_name`, `category`, `sequence`

Notes:
- Backend forces `status = "Active"` on create.

### Machine Pattern

UI path:
- System Settings → **Machine → Pattern** → Add

API call:
- `POST /api/machine-parameters`

Payload:
- `pattern_name`, `machine_count`, `operating_hours` (optional `category`)

Notes:
- Backend forces `status = "Active"` on create.

### Safety Stock

UI path:
- System Settings → **Safety Stock** → Add

API call:
- `POST /api/safety-stock`

Payload:
- `inventory_type`, `item_uniq_code`, `calculation_type`, `constanta`

Notes:
- The **Create Stock days** button persists one entry.
- **Save Parameter** will persist any remaining entries not yet created.

### Stockdays Parameter

UI path:
- System Settings → **Stockdays** → Add

API call:
- `POST /api/stockdays`

Payload:
- `inventory_type`, `item_uniq_code`, `calculation_type`, `constanta`

Notes:
- The **Create Stock days** button persists one entry.
- **Save Parameter** will persist any remaining entries not yet created.

### Approval Workflow

UI path:
- System Settings → **Approval Workflow** → Add

API call:
- `POST /api/approval-workflows`

Payload:
- `action_name`, `level_1_role`, `level_2_role`, `level_3_role`, `level_4_role`

Notes:
- Backend forces `status = "Active"` on create.

### Access Control Matrix

UI path:
- System Settings → **Access Control Matrix** → Add

API call:
- `POST /api/access-control` (called once per row you add)

Payload:
- `full_name`, `employee_id`, `department`, `role_id`

Notes:
- The UI fetches select options from:
	- `GET /api/roles`
	- `GET /api/employees`

### Roles

UI path:
- System Settings → **Roles** → Create

API call:
- `POST /api/roles`

Payload:
- `name`
- `permissions` (flat object map like `{"Dashboard::View": true, ...}`)

Notes:
- Backend forces `status = "Active"` on create.

### Purchase Order — Split Settings

UI path:
- System Settings → **Purchase Order Split** → Add

API call:
- `POST /api/po-split-settings`

Payload:
- `material_type`, `min_order_qty`, `max_split_lines`, `split_rule`

Notes:
- Backend forces `status = "Active"` on create.

## Troubleshooting

- `401/403`: your `Authorization` cookie is missing/expired.
- `404`: your backend path differs; update `ROUTES` in [src/lib/api/system-settings/api.ts](../src/lib/api/system-settings/api.ts).
- `Network Error`: check `NEXT_PUBLIC_API_URL` and that the backend is reachable from the browser.
