<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Context8 CLI Frontend

Minimal UI for Context8 Docker: admin login → create API key → save/search solutions.

## Setup
1) `npm install`
2) `.env.local`:
```
VITE_API_BASE=http://localhost:8000   # or your deployment base URL
```

## Run
```
npm run dev
```
Open `http://localhost:5173` in your browser.

## Usage
1) First visit: create the admin account
2) Login to the dashboard
3) Create an API key and use `X-API-Key` for requests
4) Fill required fields in “Save Solution” to write solutions
5) Use “Search” to query your solutions (Elasticsearch only; optional kNN if enabled)
6) Optional: set Remote base/API key in Search to federate queries against another Context8 server
