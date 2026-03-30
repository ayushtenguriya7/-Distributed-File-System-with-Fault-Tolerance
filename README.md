# DFS Control Center

DFS Control Center is a beginner-friendly full-stack web application that simulates a simple distributed file system. Users can upload files, split them into chunks, replicate the chunks across multiple nodes, and reconstruct files even if one node goes offline.

## Project Structure

```text
DFS Control Center/
├── backend/
│   ├── src/
│   │   └── dfsService.js
│   ├── storage/
│   ├── temp/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

## Features

- React dashboard with a dark glassmorphism interface
- Drag and drop upload area
- Express API with Multer file upload support
- File chunking and replication across `node1`, `node2`, and `node3`
- JSON metadata instead of a database
- SHA-256 hashing for chunk and file integrity checks
- Fault-tolerant download as long as one replica per chunk is available
- Node online/offline toggle to simulate failures
- Delete API to remove files and their chunks

## How It Works

1. A file is uploaded from the frontend.
2. The backend reads the file and splits it into chunks.
3. Every chunk is stored in two different node folders.
4. Metadata is written to `backend/storage/metadata.json`.
5. During download, the backend looks for an online node that still has each chunk.
6. The file is rebuilt in the correct order and verified with a hash.

## Run the Project

### 1. Install dependencies

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

The backend runs on `http://localhost:4000`.

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173`.

## API Endpoints

- `GET /api/health` - basic backend health check
- `GET /api/files` - list uploaded files and node status
- `POST /api/upload` - upload one file
- `GET /api/files/:id/download` - rebuild and download a file
- `DELETE /api/files/:id` - delete a file and all replicated chunks
- `PATCH /api/nodes/:nodeName` - toggle a node online/offline

## Beginner Notes

- The backend keeps all metadata in a single JSON file to make the project easy to understand.
- Chunk size is currently set to `256 KB` in `backend/src/dfsService.js`.
- Replication is handled with a simple round-robin strategy so the code stays readable.
- If both replicas for a chunk are offline or missing, download will fail, which helps demonstrate fault tolerance limits.
