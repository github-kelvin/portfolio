# Professional Website

A full-stack web application with React frontend, Node.js backend API, worker service, RabbitMQ, PostgreSQL, and Stripe integration.

## Features

- Landing page with professional details
- User authentication (signup/signin)
- Dashboard with contact CRUD
- Subscription purchase via Stripe Checkout
- Payment history

## Deployment

### Manual Deployment via GitHub Actions

The application can be deployed manually to a remote server using GitHub Actions.

#### Setup

1. **Server Requirements**: Ensure your deployment server has:
   - Docker and Docker Compose installed
   - SSH access configured
   - Git repository cloned at `/path/to/your/app`

2. **GitHub Secrets Configuration**:
   Add the following secrets to your GitHub repository:
   - `SSH_PRIVATE_KEY`: Private SSH key for server access
   - `SSH_KNOWN_HOSTS`: SSH known hosts entry for the server
   - `SSH_USER`: SSH username for the server
   - `SSH_HOST`: Server hostname or IP address

3. **Environment Variables**:
   Ensure your `.env` file is present on the server with all required environment variables.

#### Deployment Process

1. Go to the **Actions** tab in your GitHub repository
2. Select **Deploy Services** workflow
3. Click **Run workflow**
4. Choose the environment (production/staging)
5. Click **Run workflow**

The workflow will:
- Connect to your server via SSH
- Pull the latest code changes
- Rebuild and restart all services with Docker Compose
- Display deployment logs

#### Data Persistence

- **PostgreSQL**: Data persists in the `postgres_data` Docker volume
- **Redis**: Data persists in the `redis_data` Docker volume with append-only file

### Local Development

1. Ensure Docker and Docker Compose are installed.

2. Clone the repository.

3. Run `docker compose up --build` to start all services.

4. Access the app at http://localhost

5. Backend API at http://localhost/api

6. RabbitMQ management at http://localhost:15672 (user: user, pass: password)

## Services

- **Frontend**: React app with Vite, served via Nginx
- **Backend**: Node.js Express API with Stripe
- **Worker**: Processes payment messages from RabbitMQ
- **PostgreSQL**: Database
- **RabbitMQ**: Message queue
- **Nginx**: Reverse proxy routing requests

## API Endpoints

- POST /api/signup
- POST /api/signin
- GET /api/contacts
- POST /api/contacts
- PUT /api/contacts/:id
- DELETE /api/contacts/:id
- POST /api/create-checkout-session
- POST /api/verify-payment
- GET /api/payments
- GET /api/professional