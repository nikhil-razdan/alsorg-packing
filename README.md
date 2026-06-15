[README.md](https://github.com/user-attachments/files/28942413/README.md)
# PackFlow

A complete inventory, packing, warehouse, dispatch and logistics management platform built for a home-interior manufacturing workflow. The system helps teams track every item from packing to warehouse movement, ready-to-dispatch status, challan generation, dispatch, delivery and audit history.

---

## Overview

**Alsorg Inventory Suite** is designed to bring operational visibility and control across factory packing, warehouse, dispatch and logistics teams. It replaces scattered manual tracking with a centralized system where every item, packet, sticker, challan and movement can be tracked with role-based access.

The application supports:

- Item creation and packet-level tracking
- QR-based sticker generation and scanning
- Warehouse receiving and movement workflows
- Dispatch challan generation
- Logistics and delivery tracking
- User, role and permission management
- Audit history and operational activity logs
- Dashboards, analytics and exportable reports

---

## Core Workflow

The app follows the actual operational flow used inside the organization:

```text
Production / Packing
        ↓
Sticker Generated
        ↓
Warehouse / FG Area
        ↓
Ready to Dispatch
        ↓
Dispatch Challan Generated
        ↓
Logistics / Delivery
        ↓
Completed / Delivered
```

Each item moves through the system with a clear status, ownership and history trail.

---

## Main Modules

### 1. Dashboard

The dashboard gives a live overview of the complete operation.

It includes:

- Total inventory items
- Packed items
- Warehouse items
- Ready-to-dispatch items
- Dispatched items
- Daily throughput
- Recent activity
- Status charts and analytics
- Operational alerts

The dashboard helps management understand the current position of stock, packing, dispatch and pending actions.

---

### 2. Packing Module

The packing module is used by the packing team to create and manage packed items.

Main functions:

- Create new items
- Create custom items
- Add product details
- Assign packet details
- Generate stickers
- Preview sticker before generation
- Track sticker history
- Move packed items forward in the workflow

Typical packing flow:

```text
Create Item → Add Details → Generate Sticker → Attach Sticker → Move to Warehouse / FG
```

---

### 3. Sticker Management

Sticker generation is one of the most important parts of the system because it gives every packet a scannable identity.

Sticker information may include:

- Sticker number
- PD number
- Drawing number
- Packet number
- Floor
- Client / site details
- Item name
- Description
- Dimensions
- Volume
- Weight
- Code / SKU
- QR code
- Remarks
- Prepared / checked / delivered signature area

The QR code allows users to quickly scan and fetch item information.

---

### 4. Warehouse Module

The warehouse module helps the warehouse team receive, verify and manage items after packing.

Main functions:

- View items moved from packing
- Search and filter warehouse stock
- Track item status
- Request restore or return where applicable
- Approve or reject warehouse movement actions based on permissions
- Maintain warehouse visibility for management

Common warehouse statuses:

- Warehouse
- Ready to Store
- Ready
- Ready to Dispatch
- Warehouse Return Requested

---

### 5. Dispatch Module

The dispatch module is used to prepare items for final dispatch and generate dispatch challans.

Main functions:

- View ready-to-dispatch items
- Select items for dispatch
- Generate dispatch challan
- Track dispatched items
- Manage dispatch history
- Validate dispatch status
- Support bulk actions where allowed

Typical dispatch flow:

```text
Ready to Dispatch → Select Items → Generate Challan → Dispatch Items → Logistics Tracking
```

---

### 6. Logistics Module

The logistics module is used for delivery and transport-related tracking.

Main functions:

- View dispatched items
- Assign logistics details
- Track delivery status
- Manage vehicle / driver-related information where applicable
- Support operational follow-up after challan generation

---

### 7. Challan Management

The system supports challan-based movement and dispatch documentation.

Challan-related features may include:

- Internal movement challan
- Dispatch challan
- Challan preview
- Challan generation
- Challan history
- Download / print support depending on screen permissions

---

### 8. Reports Center

Reports help users export and review operational data.

Available report areas may include:

- Packing reports
- Dispatch reports
- Combined reports
- Aging reports
- CSV / Excel exports

Reports are useful for management review, daily operations, audit checks and performance tracking.

---

### 9. User Management

Admins can manage users and their roles from the user management section.

Main functions:

- Create users
- Assign roles
- Update user details
- Activate / deactivate users where supported
- Control access by role
- Maintain accountability for actions performed inside the system

---

## User Roles and Permissions

The system uses role-based access control so each department only sees and performs the actions relevant to them.

### ADMIN

Admin has the highest level of control.

Typical access:

- Dashboard
- User management
- Packing visibility
- Warehouse visibility
- Dispatch visibility
- Logistics visibility
- Reports
- Audit logs
- Permission-sensitive approval actions

### PACKING

Packing users handle item creation and sticker generation.

Typical access:

- Create items
- Create custom items
- Generate stickers
- View packing-related records
- Move packed items forward as allowed

### WAREHOUSE

Warehouse users manage items after packing and before dispatch.

Typical access:

- View warehouse items
- Manage warehouse status
- Handle warehouse movement workflows
- Request return / restore where allowed

### DISPATCH

Dispatch users handle ready-to-dispatch items and challan generation.

Typical access:

- View ready-to-dispatch items
- Move items to FG / dispatch stage where allowed
- Generate dispatch challans
- Manage dispatched item records

### LOGISTICS

Logistics users handle post-dispatch movement and delivery tracking.

Typical access:

- View dispatched items
- Track delivery flow
- Update logistics-related movement where allowed

---

## Permission Matrix

| Module / Action | ADMIN | PACKING | WAREHOUSE | DISPATCH | LOGISTICS |
|---|---:|---:|---:|---:|---:|
| View Dashboard | Yes | Limited | Limited | Limited | Limited |
| Manage Users | Yes | No | No | No | No |
| Create Item | Yes | Yes | No | No | No |
| Create Custom Item | Yes | Yes | No | No | No |
| Generate Sticker | Yes | Yes | No | No | No |
| View Warehouse Items | Yes | No / Limited | Yes | Limited | No / Limited |
| Manage Warehouse Flow | Yes | No | Yes | Limited | No |
| Move Item to FG | As configured | No | No / Limited | Yes | No |
| Generate Dispatch Challan | Yes | No | No | Yes | No |
| View Dispatch Records | Yes | Limited | Limited | Yes | Yes |
| Logistics Tracking | Yes | No | No | Limited | Yes |
| Export Reports | Yes | Limited | Limited | Limited | Limited |
| View Audit / History | Yes | Limited | Limited | Limited | Limited |

> Note: Final permissions depend on the backend security configuration and the role checks implemented in controllers/services.

---

## Tech Stack

### Frontend

- React.js
- Material UI
- Framer Motion
- Axios
- JavaScript / JSX

### Backend

- Java
- Spring Boot
- Spring Security
- JWT Authentication
- Spring Data JPA / Hibernate
- PostgreSQL

### PDF / Document Generation

- PDFBox or backend PDF service
- QR code generation
- Sticker PDF generation
- Challan PDF generation

### Deployment

- Render or similar cloud hosting
- PostgreSQL database
- Environment-based configuration

---

## Suggested Repository Structure

```text
alsorg-inventory-suite/
│
├── backend/
│   ├── src/main/java/
│   │   └── com/alsorg/packing/
│   │       ├── controller/
│   │       ├── service/
│   │       ├── repository/
│   │       ├── domain/
│   │       ├── security/
│   │       └── config/
│   │
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── application-render.yml
│   │
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── config.js
│   │   └── App.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── .gitignore
```

Your actual folder structure may differ. Update this section according to the final repository layout.

---

## Prerequisites

Before running the project locally, install:

- Java 17 or higher
- Maven
- Node.js
- npm
- PostgreSQL
- Git

---

## Environment Variables

Create environment variables for local development and deployment.

### Backend Environment Variables

```env
DATABASE_URL=your_postgresql_database_url
DB_USERNAME=your_database_username
DB_PASSWORD=your_database_password
JWT_SECRET=your_jwt_secret
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
```

### Frontend Environment Variables

```env
VITE_API_BASE_URL=http://localhost:8080
```

If the project uses a `config.js` file instead of `.env`, update the API base URL there.

---

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

---

### 2. Backend Setup

Go to the backend folder:

```bash
cd backend
```

Install dependencies and run the Spring Boot app:

```bash
mvn clean install
mvn spring-boot:run
```

By default, the backend should run on:

```text
http://localhost:8080
```

---

### 3. Frontend Setup

Open another terminal and go to the frontend folder:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

The frontend usually runs on:

```text
http://localhost:5173
```

---

## Database Setup

Create a PostgreSQL database for the project.

Example:

```sql
CREATE DATABASE alsorg_inventory;
```

Update the database connection details in your backend environment variables or application configuration.

For development, Hibernate may be configured with:

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update
```

For production, use safer migration practices and avoid accidental schema changes.

---

## Authentication

The application uses JWT-based authentication.

Typical authentication flow:

```text
Login → Backend validates user → JWT generated → Frontend stores token → Token sent with API requests
```

Protected routes and APIs check the user role before allowing sensitive actions.

---

## Important Status Flow

The exact enum names may depend on backend implementation, but the operational flow usually includes statuses like:

```text
PACKED
READY_TO_STORE
WAREHOUSE
READY
READY_TO_DISPATCH
DISPATCHED
DELIVERED
WAREHOUSE_RETURN_REQUESTED
```

These statuses help the system decide where the item is visible and which role can act on it.

---

## Development Rules

To keep the project safe and clean:

1. Do not push directly to the `main` branch.
2. Create a separate branch for every feature or fix.
3. Keep `.env` files and secrets out of GitHub.
4. Test changes locally before raising a pull request.
5. Do not change existing workflows without understanding permissions.
6. Do not modify backend role checks casually.
7. Keep UI changes consistent with the existing design system.
8. Mention all major changes clearly in commit messages.

Recommended branch naming:

```text
feature/add-report-filter
fix/dispatch-permission-error
ui/improve-warehouse-page
backend/sticker-history-fix
```

---

## Git Workflow for Developers / Interns

### Create a new branch

```bash
git checkout -b feature/your-feature-name
```

### Check changed files

```bash
git status
```

### Add files

```bash
git add .
```

### Commit changes

```bash
git commit -m "Add meaningful commit message"
```

### Push branch

```bash
git push origin feature/your-feature-name
```

### Open a Pull Request

After pushing, open a pull request on GitHub and request review before merging.

---

## Security Notes

Never commit:

- Database passwords
- JWT secrets
- Gmail app passwords
- Production API URLs if private
- `.env` files
- Local IDE metadata
- Build output folders

Use `.gitignore` properly to keep the repository clean.

---

## Recommended `.gitignore`

```gitignore
# Java / Maven
target/
*.class

# Node / React
node_modules/
dist/
build/

# Environment files
.env
.env.local
.env.production

# IDE files
.idea/
.vscode/
.metadata/
.settings/
.classpath
.project

# Logs
*.log
logs/

# OS files
.DS_Store
Thumbs.db
```

---

## Deployment Notes

For deployment on Render or a similar platform:

1. Create a PostgreSQL database.
2. Add backend environment variables.
3. Connect the GitHub repository.
4. Set the backend build command.
5. Set the backend start command.
6. Deploy the backend service.
7. Deploy the frontend service.
8. Update frontend API base URL to point to the deployed backend.
9. Test login, dashboard, sticker generation, warehouse flow and dispatch flow.

Example backend build command:

```bash
mvn clean package -DskipTests
```

Example backend start command:

```bash
java -jar target/*.jar
```

Example frontend build command:

```bash
npm install && npm run build
```

---

## Testing Checklist

Before considering a change complete, test:

- Login and logout
- Role-based page access
- Item creation
- Custom item creation
- Sticker generation
- QR scan flow
- Warehouse movement
- Ready-to-dispatch status
- Dispatch challan generation
- Reports export
- User management
- Pagination
- Date and time display
- Unauthorized action handling

---

## Troubleshooting

### Backend is not starting

Check:

- Java version
- Database connection
- Environment variables
- Port availability
- Maven dependencies

### Frontend cannot connect to backend

Check:

- API base URL
- Backend server status
- CORS configuration
- Network tab in browser developer tools

### JWT expired error

The user session token has expired. Log out and log in again. Backend should return a clean unauthorized response instead of crashing the request.

### 403 Forbidden error

The logged-in user does not have permission for that action. Confirm the user's role and backend authorization rules.

---

## Future Improvements

Possible future enhancements:

- Mobile app integration with ShipTrack
- More advanced logistics tracking
- Barcode / QR scanner optimization
- Better role-specific dashboards
- Notification system
- Approval workflows
- Advanced aging reports
- Plant-wise and floor-wise analytics
- Automated email alerts
- Improved audit trail exports

---

## Project Naming

- Web Application: **Alsorg Inventory Suite**
- Mobile Dispatch / Logistics App: **ShipTrack**

---

## Maintainers

This project is maintained by the Alsorg operations / development team.

For internal queries, contact the project owner or assigned administrator.

---

## License

This is a private internal project. Unauthorized copying, sharing or distribution is not allowed.
