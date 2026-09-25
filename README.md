# E-Barangay Dumanguena

## Roles
| Login | Password | Role in system | Shown as |
|-------|----------|----------------|----------|
| admin | admin123 | Admin | **Captain** |
| captain | cap123 | Admin | **Captain** |
| secretary | sec123 | Secretary | Secretary |
| treasurer | treas123 | Treasurer | Treasurer |

Captain module was removed. Full system administration remains under the **Admin** role, displayed as **Captain**.

Documents auto-release after Treasurer verifies payment. Only the resident can download PDFs.

---

## Database

This system includes a ready-to-use database file:

### `e-barangay.db` (SQLite)
- Single-file database that stores **all transactions and information**:
  - Residents
  - Document requests (clearance, indigency, residency, business permit, blotter, etc.)
  - Payments / financial transactions
  - Users & roles
  - Services / events
  - Notifications
  - Barangay profiling
  - Document types & fees
  - Transaction audit log

**Location:** `e-barangay.db` (inside the project folder)

You can open it with:
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- VS Code SQLite extensions
- Any SQLite client
- Python: `sqlite3.connect("e-barangay.db")`

### MySQL / MariaDB
A full MySQL-compatible schema is provided in:

**`schema-mysql.sql`**

Import it with:
```bash
mysql -u root -p < schema-mysql.sql
```
or create a database named `e_barangay` and run the script.

### Current frontend note
The web app still uses **browser localStorage** for immediate offline use.  
To connect the UI to the real database (`e-barangay.db` or MySQL), a backend (Node.js, PHP, Python/Flask, etc.) is required that reads/writes these tables and exposes a REST API. The schema is designed to match the existing data model 1:1 so integration is straightforward.

### Tables overview
| Table | Purpose |
|-------|---------|
| `residents` | Resident master records |
| `users` | Login accounts (Admin, Secretary, Treasurer, Resident) |
| `documents` | Document requests & status workflow |
| `payments` | Payment transactions linked to documents |
| `doc_types` | Available certificates + fees |
| `services` | Barangay services / events |
| `notifications` | System notifications |
| `pending_registrations` | New account requests awaiting verification |
| `profiling` | Barangay info (captain, contact, etc.) |
| `settings` | GCash number & other config |
| `transaction_log` | Audit trail of important actions |


---

## Updates (v23)

### Document processing
- Residents **cannot** view or download the official filled document until status is **Released**.
- Paid documents: Released only after Treasurer verifies payment.
- Free documents: Released after Secretary endorsement.
- My Requests shows Status / Pay buttons until released; official PDF only after payment verification.

### Resident profile & information
- **Automatic age** computed from birth date (profile + admin/secretary resident forms).
- **Household members** (name, relation, birth date, auto age) — editable in:
  - Resident Portal → My Profile
  - Captain/Admin & Secretary → Resident Information (Edit Resident)
- Profile fields remain editable by the resident.

### Separate dashboards
- **Secretary Dashboard** — residency verification, document review & endorsement (own module; no shared Admin dashboard).
- **Treasurer Dashboard** — payment collection, GCash verification & receipts (own module).
- **Captain / Admin Dashboard** — overview + **full document transactions (Secretary)** and **full payment transactions (Treasurer)**.
