import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = "http://localhost:4000/api";

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function App() {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [nodes, setNodes] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("Ready to cluster files.");

  const onlineNodeCount = useMemo(
    () => Object.values(nodes).filter((node) => node.online).length,
    [nodes]
  );

  async function fetchFiles() {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/files`);
      const data = await response.json();
      setFiles(data.files || []);
      setNodes(data.nodes || {});
    } catch (error) {
      setMessage(`Unable to load files: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, []);

  async function uploadFile(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    setMessage(`Uploading ${file.name}...`);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Upload failed.");
      }

      setMessage(data.message);
      await fetchFiles();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function downloadFile(fileId, filename) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Download failed.");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage(`Downloaded ${filename}`);
    } catch (error) {
      setMessage(error.message);
    }
  }
  function openFile(fileId, filename) {
    const openUrl = `${API_BASE_URL}/files/${fileId}/open`;
    const openedTab = window.open(openUrl, "_blank", "noopener,noreferrer");

    if (!openedTab) {
      setMessage("Popup blocked. Please allow popups for this site.");
      return;
    }

    setMessage(`Opened ${filename}`);
  }

  async function deleteFile(fileId) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Delete failed.");
      }

      setMessage(data.message);
      await fetchFiles();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function toggleNode(nodeName, online) {
    try {
      const response = await fetch(`${API_BASE_URL}/nodes/${nodeName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ online: !online }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to change node state.");
      }

      setNodes(data.nodes);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    uploadFile(droppedFile);
  }

  return (
    <div className="min-h-screen bg-dashboard-grid px-4 py-6 text-slate-100 md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-200/70">
                Distributed File System Simulator
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">
                DFS Control Center
              </h1>
            </div>

            <div className="flex items-center gap-3 self-start rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.8)]" />
              System Online
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr,1.5fr]">
          <div className="space-y-6">
            <div
              className={`rounded-3xl border p-6 shadow-glow backdrop-blur-xl transition duration-300 ${
                isDragging
                  ? "border-sky-300 bg-sky-400/15"
                  : "border-white/10 bg-white/10"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="flex h-full min-h-[280px] flex-col items-start justify-between gap-6 rounded-2xl border border-dashed border-white/15 bg-slate-950/35 p-6">
                <div className="space-y-3">
                  <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-sky-200">
                    Upload to DFS
                  </span>
                  <h2 className="text-2xl font-semibold text-white">
                    Drag &amp; drop or cluster files...
                  </h2>
                  <p className="max-w-sm text-sm leading-6 text-slate-300">
                    Upload a file, split it into chunks, and replicate each chunk
                    across simulated storage nodes for fault-tolerant recovery.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={isUploading}
                    className="rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 font-medium text-white shadow-lg shadow-sky-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading ? "Uploading..." : "Browse Files"}
                  </button>

                  <p className="text-sm text-slate-300">
                    Drop one file at a time for a simple beginner-friendly flow.
                  </p>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => uploadFile(event.target.files?.[0])}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-glow backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Cluster Nodes</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {onlineNodeCount} of {Object.keys(nodes).length || 3} nodes online
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-900/50 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
                  Fault Tolerance
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {Object.entries(nodes).map(([nodeName, node]) => (
                  <div
                    key={nodeName}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 transition hover:border-sky-300/30"
                  >
                    <div>
                      <p className="font-medium text-white">{nodeName}</p>
                      <p
                        className={`text-sm ${
                          node.online ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {node.online ? "Online" : "Offline"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleNode(nodeName, node.online)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${
                        node.online
                          ? "bg-rose-500/15 text-rose-200"
                          : "bg-emerald-500/15 text-emerald-200"
                      }`}
                    >
                      Set {node.online ? "Offline" : "Online"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-glow backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Stored Files</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Inspect chunk counts, integrity hashes, and file recovery options.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchFiles}
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-300/30 hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-sky-100">
              {message}
            </div>

            {isLoading ? (
              <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/35 p-8 text-center text-slate-300">
                Loading DFS metadata...
              </div>
            ) : files.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-10 text-center">
                <p className="text-lg font-medium text-white">No files clustered</p>
                <p className="mt-2 text-sm text-slate-400">
                  Upload your first file to see chunk replication across nodes.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-slate-950/60 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 font-medium">Filename</th>
                        <th className="px-4 py-3 font-medium">Size</th>
                        <th className="px-4 py-3 font-medium">Chunks</th>
                        <th className="px-4 py-3 font-medium">Integrity</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-slate-950/35">
                      {files.map((file) => (
                        <tr
                          key={file.id}
                          className="transition hover:bg-white/5"
                        >
                          <td className="px-4 py-4 align-top">
                            <p className="font-medium text-white">{file.filename}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(file.uploadedAt).toLocaleString()}
                            </p>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-200">
                            {formatBytes(file.size)}
                          </td>
                          <td className="px-4 py-4 align-top text-slate-200">
                            {file.chunkCount}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <p className="max-w-[180px] truncate text-xs text-slate-300">
                              {file.hash}
                            </p>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openFile(file.id, file.filename)}
                                className="rounded-xl bg-emerald-500/15 px-3 py-2 text-emerald-200 transition hover:bg-emerald-500/25"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadFile(file.id, file.filename)}
                                className="rounded-xl bg-sky-500/15 px-3 py-2 text-sky-200 transition hover:bg-sky-500/25"
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFile(file.id)}
                                className="rounded-xl bg-rose-500/15 px-3 py-2 text-rose-200 transition hover:bg-rose-500/25"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-white/10 bg-slate-950/55 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                    Chunk Distribution
                  </h3>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {files.map((file) => (
                      <div
                        key={`${file.id}-distribution`}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <p className="font-medium text-white">{file.filename}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {file.distribution.map((chunk) => (
                            <div
                              key={`${file.id}-${chunk.index}`}
                              className="min-w-[120px] rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2"
                            >
                              <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
                                Chunk {chunk.index + 1}
                              </p>
                              <p className="mt-1 text-sm text-slate-200">
                                {chunk.nodes.join(" + ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
