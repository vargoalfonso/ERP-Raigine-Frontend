# System Settings — UI API Testing

This document explains how to test the **System Settings** modules that are now wired to the backend (ERP-Raigine routes) through the UI.

## Prerequisites

1. Set the API base URL in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

2. Ensure you are logged in (or have a valid auth cookie):

- The frontend reads the `Authorization` cookie and sends it as `Authorization: Bearer <token>` for these endpoints.

## How the integration works

- If `NEXT_PUBLIC_API_URL` is **not set** (or is literally `"undefined"`), the UI keeps the existing **mock behavior** (shows success messages and navigates back).
- If `NEXT_PUBLIC_API_URL` **is set**, the UI will call the backend via RTK Query mutations.

All System Settings endpoints are defined in:

- [src/lib/api/system-settings/api.ts](../src/lib/api/system-settings/api.ts)

If your backend route prefixes differ, update the `ROUTES` constants in that file.

## Modules & what to click

All create screens are under:

- `/system-settings` (hub)
- then press **Add/Create** for the relevant module

### UoM (Global)

UI path:
- System Settings → **UoM Global** → Add

API call when enabled:
- `POST /uom/create`

Payload (sent as snake_case):
- `type_code`, `type_name`, `category`, `status`

### Type Parameters

UI path:
- System Settings → **Type Parameters** → Add

API call:
- `POST /type-parameter/create`

Payload:
- `type_code`, `type_name`, `description`, `status`

### Global — Working Days

UI path:
- System Settings → **Global (Working Days)** → Add

API call:
- `POST /global/create`

Payload:
- `period`, `working_days`

### Kanban — FG Standards

UI path:
- System Settings → **Kanban** → Add

API call:
- `POST /kanban/create`

Payload:
- `product_name`, `product_code`, `kanban_qty`, `min_stock`, `max_stock`, `status`

### Process

UI path:
- System Settings → **Process** → Add

API call:
- `POST /process/create`

Payload:
- `category`, `process_name`, `sequence`, `status`

### Machine Pattern

UI path:
- System Settings → **Machine → Pattern** → Add

API call:
- `POST /machine-pattern/create`

Payload:
- `machine_name`, `machine_count`, `operating_hours`, `status`

### Safety Stock

UI path:
- System Settings → **Safety Stock** → Add

API call:
- `POST /safety-stock/create`

Payload:
- `type`, `uniq`, `calculation_type`, `constanta`

Notes:
- The **Create Stock days** button persists one entry.
- **Save Parameter** will persist any remaining entries not yet created.

### Stockdays Parameter

UI path:
- System Settings → **Stockdays** → Add

API call:
- `POST /stockdays-parameter/create`

Payload:
- `type`, `uniq`, `calculation_type`, `constanta`

Notes:
- The **Create Stock days** button persists one entry.
- **Save Parameter** will persist any remaining entries not yet created.

### Approval Workflow

UI path:
- System Settings → **Approval Workflow** → Add

API call:
- `POST /approval/create`

Payload:
- `menu_action`, `level_1_role`, `level_2_role`, `level_3_role`, `level_4_role`, `status`

### Access Control Matrix

UI path:
- System Settings → **Access Control Matrix** → Add

API call:
- `POST /access-control-matrix/create` (called once per row you add)

Payload:
- `full_name`, `employee_id`, `department`, `role`

### Roles

UI path:
- System Settings → **Roles** → Create

API call:
- `POST /role/create`

Payload:
- `role_name`
- `permissions` (flat object map like `{"Dashboard::View": true, ...}`)

### Purchase Order — Split Settings

UI path:
- System Settings → **Purchase Order Split** → Add

API call:
- `POST /po-split/create`

Payload:
- `material_type`, `min_order_qty`, `max_split_lines`, `split_rule`, `status`

## Troubleshooting

- `401/403`: your `Authorization` cookie is missing/expired.
- `404`: your backend path differs; update `ROUTES` in [src/lib/api/system-settings/api.ts](../src/lib/api/system-settings/api.ts).
- `Network Error`: check `NEXT_PUBLIC_API_URL` and that the backend is reachable from the browser.
