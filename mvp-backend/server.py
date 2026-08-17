#!/usr/bin/env python3
"""InScreens prototype server: static files + a small JSON API.

Stdlib only (no Node/Flask available on this machine). Serves the dashboard
and test-client as static assets and backs them with:
  GET  /api/manifest              capability manifest + synthetic device profiles
  GET  /api/screens                list published screens
  GET  /api/screens/<id>/latest    latest published version of a screen
  GET  /api/screens/<id>/versions  full version history of a screen
  POST /api/screens                publish a new version of a screen
  POST /api/gate                   compatibility-gate report for a draft schema
"""
import json
import mimetypes
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
SCREENS_DIR = os.path.join(DATA_DIR, "screens")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")

STATIC_ROOTS = {
    "/dashboard": os.path.join(ROOT, "dashboard"),
    "/test-client": os.path.join(ROOT, "test-client"),
    "/shared": os.path.join(ROOT, "shared"),
}

VERSION_FILE_RE = re.compile(r"^v(\d+)\.json$")
SCREEN_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def read_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path):
        if not os.path.isfile(path):
            self._send_json({"error": "not found", "path": path}, 404)
            return
        ctype, _ = mimetypes.guess_type(path)
        ctype = ctype or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        for prefix, root in STATIC_ROOTS.items():
            if path == prefix or path == prefix + "/":
                self._send_file(os.path.join(root, "index.html"))
                return True
            if path.startswith(prefix + "/"):
                rel = path[len(prefix) + 1:]
                # Prevent path traversal outside the mapped static root.
                full = os.path.normpath(os.path.join(root, rel))
                if not full.startswith(os.path.normpath(root) + os.sep):
                    self._send_json({"error": "forbidden"}, 403)
                    return True
                self._send_file(full)
                return True
        return False

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/dashboard/")
            self.end_headers()
            return

        if path == "/api/manifest":
            self._send_json(read_json(MANIFEST_PATH, {"profiles": [], "capabilities": {}}))
            return

        if path == "/api/screens":
            self._send_json(self._list_screens())
            return

        m = re.match(r"^/api/screens/([^/]+)/latest$", path)
        if m:
            sid = m.group(1)
            latest = read_json(os.path.join(SCREENS_DIR, sid, "latest.json"))
            if latest is None:
                self._send_json({"error": "not found"}, 404)
            else:
                self._send_json(latest)
            return

        m = re.match(r"^/api/screens/([^/]+)/versions$", path)
        if m:
            sid = m.group(1)
            self._send_json(self._list_versions(sid))
            return

        if self._serve_static(path):
            return

        self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._send_json({"error": "invalid json"}, 400)
            return

        if path == "/api/gate":
            self._handle_gate(payload)
            return
        if path == "/api/screens":
            self._handle_publish(payload)
            return

        self._send_json({"error": "not found"}, 404)

    def _list_screens(self):
        if not os.path.isdir(SCREENS_DIR):
            return []
        result = []
        for sid in sorted(os.listdir(SCREENS_DIR)):
            latest = read_json(os.path.join(SCREENS_DIR, sid, "latest.json"))
            if latest:
                result.append({"id": sid, "title": latest.get("title"), "version": latest.get("version")})
        return result

    def _list_versions(self, sid):
        dirp = os.path.join(SCREENS_DIR, sid)
        if not os.path.isdir(dirp):
            return []
        versions = []
        for fn in sorted(os.listdir(dirp)):
            match = VERSION_FILE_RE.match(fn)
            if match:
                versions.append(read_json(os.path.join(dirp, fn)))
        versions.sort(key=lambda v: v.get("version", 0))
        return versions

    def _handle_gate(self, schema):
        manifest = read_json(MANIFEST_PATH, {"profiles": [], "capabilities": {}})
        required = sorted({c.get("type") for c in schema.get("components", [])})
        by_profile = []
        risk = 0
        for p in manifest.get("profiles", []):
            supported = set(manifest.get("capabilities", {}).get(p["sdkVersion"], []))
            missing = [t for t in required if t not in supported]
            affected = len(missing) > 0
            if affected:
                risk += p.get("userSharePercent", 0)
            by_profile.append({**p, "affected": affected, "missingTypes": missing})
        self._send_json({"requiredTypes": required, "riskPercent": risk, "byProfile": by_profile})

    def _handle_publish(self, schema):
        sid = schema.get("id")
        if not sid or not SCREEN_ID_RE.match(sid):
            self._send_json({"error": "schema.id must be a non-empty alphanumeric/dash id"}, 400)
            return
        dirp = os.path.join(SCREENS_DIR, sid)
        os.makedirs(dirp, exist_ok=True)
        existing = [
            int(VERSION_FILE_RE.match(fn).group(1))
            for fn in os.listdir(dirp)
            if VERSION_FILE_RE.match(fn)
        ]
        next_version = (max(existing) + 1) if existing else 1
        published = {**schema, "version": next_version}
        write_json(os.path.join(dirp, f"v{next_version}.json"), published)
        write_json(os.path.join(dirp, "latest.json"), published)
        self._send_json(published)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"InScreens prototype server running at http://localhost:{port}")
    server.serve_forever()
