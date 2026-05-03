"""
Combined static file + DWG conversion server for Render deployment.

Serves the web app at / and handles DWG→DXF conversion at /convert.
Single process, single port — suitable for container hosting.
"""

import os
import re
import shutil
import subprocess
import tempfile
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = int(os.environ.get("PORT", "10000"))

# Locate ODA File Converter
ODA_BIN = os.environ.get("ODA_CONVERTER", "")
if not ODA_BIN or not Path(ODA_BIN).exists():
    for candidate in ["/usr/bin/ODAFileConverter", shutil.which("ODAFileConverter") or ""]:
        if candidate and Path(candidate).exists():
            ODA_BIN = candidate
            break

# Serve from the repo root so /web/..., /assets/... all resolve naturally
ROOT_DIR = Path(__file__).resolve().parent.parent


def convert_dwg_to_dxf(dwg_bytes, filename):
    if not ODA_BIN:
        raise RuntimeError("ODA File Converter not found.")

    with tempfile.TemporaryDirectory(prefix="flowlytics_") as tmpdir:
        in_dir = Path(tmpdir) / "in"
        out_dir = Path(tmpdir) / "out"
        in_dir.mkdir()
        out_dir.mkdir()

        dwg_path = in_dir / filename
        dwg_path.write_bytes(dwg_bytes)

        cmd = [ODA_BIN, str(in_dir), str(out_dir), "ACAD2018", "DXF", "0", "1"]
        result = subprocess.run(cmd, capture_output=True, timeout=60)

        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")
            raise RuntimeError(f"ODA converter failed (exit {result.returncode}): {stderr}")

        dxf_files = list(out_dir.glob("*.dxf"))
        if not dxf_files:
            raise RuntimeError("Conversion produced no .dxf output")

        return dxf_files[0].read_text(encoding="utf-8", errors="replace")


class FlowlyticsHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/convert":
            self.send_error(404)
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._err(400, "Expected multipart/form-data")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            boundary_match = re.search(r'boundary=([^\s;]+)', content_type)
            if not boundary_match:
                self._err(400, "No boundary in Content-Type")
                return
            boundary = boundary_match.group(1).encode()

            delimiter = b"--" + boundary
            parts = body.split(delimiter)

            file_data = None
            filename = "upload.dwg"

            for part in parts:
                if not part or part.strip() == b"--" or part.strip() == b"":
                    continue
                sep_idx = part.find(b"\r\n\r\n")
                if sep_idx < 0:
                    continue
                header_bytes = part[:sep_idx]
                body_bytes = part[sep_idx + 4:]
                if body_bytes.endswith(b"\r\n"):
                    body_bytes = body_bytes[:-2]
                header_str = header_bytes.decode("utf-8", errors="replace")
                if "filename=" not in header_str:
                    continue
                fn_match = re.search(r'filename="([^"]*)"', header_str)
                if fn_match:
                    filename = Path(fn_match.group(1)).name
                file_data = body_bytes
                break

            if not file_data:
                self._err(400, "No file found in request")
                return

            dxf_text = convert_dwg_to_dxf(file_data, filename)

            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(dxf_text.encode("utf-8"))

        except RuntimeError as e:
            self._err(500, str(e))
        except Exception as e:
            self._err(500, f"Unexpected error: {e}")

    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.send_response(302)
            self.send_header("Location", "/web/index.html")
            self.end_headers()
            return
        super().do_GET()

    def _err(self, code, message):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        print(f"[flowlytics] {fmt % args}")


def main():
    if ODA_BIN and Path(ODA_BIN).exists():
        print(f"ODA File Converter: {ODA_BIN}")
    else:
        print("WARNING: ODA File Converter not found. .dwg conversion will fail.")

    print(f"Serving from {ROOT_DIR}")
    server = HTTPServer(("0.0.0.0", PORT), FlowlyticsHandler)
    print(f"Flowlytics running on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
