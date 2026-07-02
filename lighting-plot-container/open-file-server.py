#!/usr/bin/env python3
"""
Minimal HTTP server (port 6081) that accepts an "open file" command from crew-hub
and restarts Perastage with the requested file path.

POST /open  {"path": "/data/perastage/home/projects/<id>/file.pstg"}
GET  /health  → 200 OK
"""
import json
import os
import signal
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

OPEN_FILE_PATH = "/tmp/perastage-open-file"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"ok": True})
        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/open":
            self._respond(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception:
            self._respond(400, {"error": "invalid json"})
            return

        file_path = data.get("path", "").strip()
        if file_path and ".." in file_path:
            self._respond(400, {"error": "invalid path"})
            return

        if file_path and not os.path.exists(file_path):
            self._respond(404, {"error": "file not found"})
            return

        # Write path for the wrapper script (omit to start fresh with no file)
        if file_path:
            with open(OPEN_FILE_PATH, "w") as f:
                f.write(file_path)
        else:
            # Ensure no stale open-file marker and clear Perastage's last-project
            # memory so it starts with a blank project rather than reopening the last file.
            try:
                os.remove(OPEN_FILE_PATH)
            except FileNotFoundError:
                pass
            last_project = os.path.join(
                os.environ.get("HOME", "/data/perastage/home"),
                ".Perastage", "last_project.txt"
            )
            try:
                os.remove(last_project)
            except FileNotFoundError:
                pass

        try:
            subprocess.run(["supervisorctl", "restart", "perastage"], check=True)
            self._respond(200, {"ok": True, "path": file_path})
        except subprocess.CalledProcessError as e:
            self._respond(500, {"error": str(e)})

    def _respond(self, status: int, body: dict):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 6081), Handler)
    print("open-file-server listening on :6081", flush=True)
    server.serve_forever()
