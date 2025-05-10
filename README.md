# CS2 Practice Queue

This is a real-time web application for managing 10-man CS2 matches using a captain draft system and map veto. Built with Node.js, Socket.IO, and Tailwind CSS on the frontend.

## Getting Started

1. Clone the repository:
   - git clone https://github.com/GoogieHD/csprac.git
   - cd cs2-prac-queue

2. Install dependencies:
   - npm install

3. Start the server:

4. For Admin Access:
   - http://localhost:3000/admin-login.html

The application will run at http://localhost:3000

---

## Starting the Backend

1. **Ensure MongoDB is Running**:
   - If MongoDB is installed as a service, it should already be running.
   - Otherwise, start MongoDB manually:
     ```bash
     mongod
     ```

2. **Apply Database Migrations**:
   ```bash
   npm run migrate:up
   ```

3. **Start the Backend Server**:
   ```bash
   npm start
   ```

4. **Verify the Backend**:
   - Open a browser or use a tool like Postman to access the root endpoint:
     ```
     http://localhost:5000/
     ```
   - You should see the message: `Welcome to the CS Practice Queue API. Documentation coming soon.`

---
