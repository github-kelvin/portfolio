# Professional Website

A full-stack web application with React frontend, Node.js backend API, worker service, RabbitMQ, PostgreSQL, and Stripe integration.

## Features

- Landing page with professional details
- User authentication (signup/signin)
- Dashboard with contact CRUD
- Subscription purchase via Stripe Checkout
- Payment history

## Setup

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