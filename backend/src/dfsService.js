const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const storageRoot = path.join(__dirname, "..", "storage");
const metadataPath = path.join(storageRoot, "metadata.json");
const nodeNames = ["node1", "node2", "node3"];
const defaultChunkSize = 1024 * 256;

function ensureStorageSetup() {
  fs.mkdirSync(storageRoot, { recursive: true }); // OS/filesystem call: ensure root storage directory exists

  for (const nodeName of nodeNames) {
    fs.mkdirSync(path.join(storageRoot, nodeName), { recursive: true }); // OS/filesystem call: ensure each node directory exists
  }

  if (!fs.existsSync(metadataPath)) { // OS/filesystem check: metadata file presence
    const initialMetadata = {
      nodes: {
        node1: { online: true },
        node2: { online: true },
        node3: { online: true },
      },
      files: {},
    };

    saveMetadata(initialMetadata);
  }
}

function loadMetadata() {
  ensureStorageSetup();
  return JSON.parse(fs.readFileSync(metadataPath, "utf-8")); // OS/filesystem call: read metadata from disk
}

function saveMetadata(metadata) {
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8"); // OS/filesystem call: persist metadata to disk
}

function createHash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function createFileId(filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  return `${Date.now()}-${safeName}`;
}

function getNodeStatus() {
  return loadMetadata().nodes;
}

function setNodeStatus(nodeName, online) {
  const metadata = loadMetadata();
  if (!metadata.nodes[nodeName]) {
    throw new Error(`Unknown node: ${nodeName}`);
  }

  metadata.nodes[nodeName].online = online;
  saveMetadata(metadata);
  return metadata.nodes;
}

function pickReplicaNodes(chunkIndex) {
  const firstNode = nodeNames[chunkIndex % nodeNames.length];
  const secondNode = nodeNames[(chunkIndex + 1) % nodeNames.length];
  return [firstNode, secondNode];
}

function storeChunkCopies(fileId, chunkIndex, chunkBuffer, replicaNodes) {
  for (const nodeName of replicaNodes) {
    const chunkName = `${fileId}-chunk-${chunkIndex}.part`;
    const chunkPath = path.join(storageRoot, nodeName, chunkName);
    fs.writeFileSync(chunkPath, chunkBuffer); // OS/filesystem call: write chunk replica to node directory
  }
}

function storeFileInDFS(tempFilePath, originalName) {
  const metadata = loadMetadata();
  const fileBuffer = fs.readFileSync(tempFilePath); // OS/filesystem call: read uploaded temp file from disk
  const fileId = createFileId(originalName);
  const fileHash = createHash(fileBuffer);
  const chunks = [];

  for (
    let offset = 0, chunkIndex = 0;
    offset < fileBuffer.length;
    offset += defaultChunkSize, chunkIndex += 1
  ) {
    const chunkBuffer = fileBuffer.slice(offset, offset + defaultChunkSize);
    const replicaNodes = pickReplicaNodes(chunkIndex);
    storeChunkCopies(fileId, chunkIndex, chunkBuffer, replicaNodes);

    chunks.push({
      index: chunkIndex,
      size: chunkBuffer.length,
      hash: createHash(chunkBuffer),
      nodes: replicaNodes,
    });
  }

  metadata.files[fileId] = {
    id: fileId,
    filename: originalName,
    size: fileBuffer.length,
    chunkCount: chunks.length,
    hash: fileHash,
    uploadedAt: new Date().toISOString(),
    chunks,
  };

  saveMetadata(metadata);
  return metadata.files[fileId];
}

function findAvailableChunkPath(fileId, chunk) {
  const metadata = loadMetadata();

  for (const nodeName of chunk.nodes) {
    const isNodeOnline = metadata.nodes[nodeName]?.online;
    const chunkPath = path.join(
      storageRoot,
      nodeName,
      `${fileId}-chunk-${chunk.index}.part`
    );

    if (isNodeOnline && fs.existsSync(chunkPath)) { // OS/filesystem check: verify chunk file exists on node
      return chunkPath;
    }
  }

  throw new Error(
    `Chunk ${chunk.index} is unavailable because all replicas are missing or offline.`
  );
}

function rebuildFileBuffer(fileId) {
  const metadata = loadMetadata();
  const file = metadata.files[fileId];

  if (!file) {
    throw new Error("File metadata not found.");
  }

  const rebuiltChunks = file.chunks
    .sort((a, b) => a.index - b.index)
    .map((chunk) => {
      const chunkPath = findAvailableChunkPath(fileId, chunk);
      const chunkBuffer = fs.readFileSync(chunkPath); // OS/filesystem call: read chunk data for reconstruction
      const actualHash = createHash(chunkBuffer);

      if (actualHash !== chunk.hash) {
        throw new Error(
          `Integrity check failed for chunk ${chunk.index}. Expected ${chunk.hash} but found ${actualHash}.`
        );
      }

      return chunkBuffer;
    });

  const buffer = Buffer.concat(rebuiltChunks);
  const rebuiltHash = createHash(buffer);

  if (rebuiltHash !== file.hash) {
    throw new Error("File integrity check failed after reconstruction.");
  }

  return { buffer, file };
}

function deleteFileFromDFS(fileId) {
  const metadata = loadMetadata();
  const file = metadata.files[fileId];

  if (!file) {
    throw new Error("File not found.");
  }

  for (const chunk of file.chunks) {
    for (const nodeName of chunk.nodes) {
      const chunkPath = path.join(
        storageRoot,
        nodeName,
        `${fileId}-chunk-${chunk.index}.part`
      );

      if (fs.existsSync(chunkPath)) { // OS/filesystem check: confirm chunk file exists before deletion
        fs.unlinkSync(chunkPath); // OS/filesystem call: delete chunk replica from disk
      }
    }
  }

  delete metadata.files[fileId];
  saveMetadata(metadata);
}

module.exports = {
  ensureStorageSetup,
  storeFileInDFS,
  loadMetadata,
  rebuildFileBuffer,
  deleteFileFromDFS,
  getNodeStatus,
  setNodeStatus,
};

