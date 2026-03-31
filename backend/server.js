const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  ensureStorageSetup,
  storeFileInDFS,
  loadMetadata,
  rebuildFileBuffer,
  deleteFileFromDFS,
  getNodeStatus,
  setNodeStatus,
} = require("./src/dfsService");

const app = express();
const PORT = process.env.PORT || 4000;

ensureStorageSetup(); // OS/filesystem setup: creates/verifies DFS storage directories

app.use(cors());
app.use(express.json());

const uploadsDirectory = path.join(__dirname, "temp");
if (!fs.existsSync(uploadsDirectory)) { // OS/filesystem check: does temp folder exist?
  fs.mkdirSync(uploadsDirectory, { recursive: true }); // OS/filesystem call: create temp folder (recursive)
}

const upload = multer({ dest: uploadsDirectory });

app.get("/", (_req, res) => {
  res.json({
    message: "DFS Control Center backend is running.",
    frontend: "http://localhost:5173",
    health: "/api/health",
    files: "/api/files",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    message: "DFS Control Center backend is running",
  });
});

app.get("/api/files", (_req, res) => {
  const metadata = loadMetadata();
  const files = Object.values(metadata.files).map((file) => ({
    id: file.id,
    filename: file.filename,
    size: file.size,
    chunkCount: file.chunkCount,
    uploadedAt: file.uploadedAt,
    hash: file.hash,
    distribution: file.chunks.map((chunk) => ({
      index: chunk.index,
      size: chunk.size,
      hash: chunk.hash,
      nodes: chunk.nodes,
    })),
  }));

  res.json({
    files,
    nodes: getNodeStatus(),
  });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload a file." });
  }

  try {
    const storedFile = storeFileInDFS(req.file.path, req.file.originalname);
    res.status(201).json({
      message: "File uploaded and clustered successfully.",
      file: storedFile,
      nodes: getNodeStatus(),
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to store the file in DFS.",
      error: error.message,
    });
  } finally {
    fs.unlink(req.file.path, () => {}); // OS/filesystem call: delete temporary uploaded file
  }
});

app.get("/api/files/:id/open", (req, res) => {
  try {
    const { buffer, file } = rebuildFileBuffer(req.params.id);
    const safeFilename = file.filename.replace(/"/g, "");

    res.type(file.filename);
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      message: "Unable to reconstruct the file.",
      error: error.message,
    });
  }
});

app.get("/api/files/:id/download", (req, res) => {
  try {
    const { buffer, file } = rebuildFileBuffer(req.params.id);
    const safeFilename = file.filename.replace(/"/g, "");

    res.type(file.filename);
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      message: "Unable to reconstruct the file.",
      error: error.message,
    });
  }
});

app.delete("/api/files/:id", (req, res) => {
  try {
    deleteFileFromDFS(req.params.id);
    res.json({
      message: "File and related chunks deleted successfully.",
      nodes: getNodeStatus(),
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
});

app.patch("/api/nodes/:nodeName", (req, res) => {
  const { nodeName } = req.params;
  const { online } = req.body;

  if (typeof online !== "boolean") {
    return res.status(400).json({
      message: "The 'online' field must be a boolean value.",
    });
  }

  try {
    const nodes = setNodeStatus(nodeName, online);
    res.json({
      message: `Node ${nodeName} is now ${online ? "online" : "offline"}.`,
      nodes,
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`DFS backend listening on http://localhost:${PORT}`);
});


