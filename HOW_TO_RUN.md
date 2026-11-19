# Run Scam Saver in VS Code

This guide explains how to start Scam Saver locally on macOS. The Node.js backend also serves the website files, so you do not need a separate frontend server.

## 1. Open the project

1. Install [Node.js](https://nodejs.org/) and [Visual Studio Code](https://code.visualstudio.com/) if they are not installed.
2. In VS Code, choose **File → Open Folder…** and open this Scam Saver project folder.
3. Choose **Terminal → New Terminal**. The terminal should be at the project root, where `package.json` is located.



## 2. Install project dependencies

Run this once from the project root:

```bash
npm install
```

## 3. Configure environment variables

Create your private environment file:

```bash
cp .env.example .env
```

Open `.env` in VS Code and set the values you need:

- `MONGODB_URI`: local MongoDB is `mongodb://127.0.0.1:27017/scam-saver`; for MongoDB Atlas, paste your Atlas connection string instead.
- `JWT_SECRET`: replace the example with a long random secret. On macOS, generate one with `openssl rand -base64 32`.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: set the initial administrator login before creating the admin account.
- `GEMINI_API_KEY`: add your Gemini API key here if you want to use SCAM SAVER AI. Keep `.env` private; it is excluded from Git.
- `PORT`: defaults to `3000`.

Do not paste real keys or passwords into `.env.example` or commit `.env` to GitHub.

## 4. Start MongoDB

Scam Saver needs MongoDB running before the Node.js server starts.

### Local MongoDB

If MongoDB Community Server is installed as a Homebrew service, start it in a VS Code terminal:

```bash
brew services start mongodb-community
```

The exact Homebrew service name can vary with the MongoDB version you installed. Check the MongoDB installation instructions if that command is not recognized. You can verify the default local connection using:

```bash
mongosh "mongodb://127.0.0.1:27017/scam-saver"
```

Exit the MongoDB shell with `exit`.

### MongoDB Atlas

If using Atlas, there is no local MongoDB server to start. Set `MONGODB_URI` in `.env` to the Atlas connection string, and make sure the Atlas database user and network access settings allow your computer to connect.

## 5. Create the initial admin account (first setup only)

If you need the seeded administrator account and sample records, first set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run seed
```

**Important:** `npm run seed` clears existing users, businesses, and reports before adding demo records. Only run it on a new/empty database. Do not run it later if you need to preserve project data.

Regular users can register through the website’s **Create account** page.

## 6. Start Scam Saver

In a new VS Code terminal at the project root, run:

```bash
npm start
```

Wait for the terminal to show that MongoDB connected and Scam Saver is running. Leave this terminal open while using the site. For development with automatic server restarts after backend code changes, run:

```bash
npm run dev
```

## 7. Open the website

Visit this address in your browser:

```text
http://localhost:3000
```

The backend serves the frontend pages and API from the same server. Do not open the HTML files directly from Finder; use the `localhost` address.

## Stop or restart the servers

- Stop Scam Saver with **Control + C** in the terminal running `npm start` or `npm run dev`.
- If MongoDB was started with Homebrew, stop it with `brew services stop mongodb-community` (adjust the service name if needed).
- If you edit `.env`, restart Scam Saver so Node.js reloads the new values.

## Common issues

- **MongoDB connection failed:** start the local MongoDB service, or check that the Atlas URI and access settings are correct.
- **Port 3000 is already in use:** stop the other Scam Saver server before starting another one.
- **AI is not configured:** set `GEMINI_API_KEY` in the project-root `.env` file and restart the backend. AI responses also depend on the Gemini project having available API quota.
- **Run the automated checks:** from the project root, run `npm test`.
