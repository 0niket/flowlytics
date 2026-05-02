"""
DWG → DXF conversion server for Flowlytics.

Accepts a .dwg file via POST /convert, converts it to .dxf using ODA File Converter,
and returns the .dxf content as text.

Usage:
    python3 scripts/serve_convert.py

Requires:
    - ODA File Converter installed (the repo includes it at tools/oda_file_converter_pkg/)
    - On macOS: /Applications/ODAFileConverter.app or the path set via ODA_CONVERTER env var
"""

import os
import shutil
import subprocess
import sys
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PORT = int(os.environ.get("PORT", "8800"))

# Locate ODA File Converter
REPO_ROOT = Path(__file__).resolve().parent.parent
ODA_PATHS = [
    os.environ.get("ODA_CONVERTER", ""),
    str(REPO_ROOT / "tools" / "oda_file_converter_pkg" / "Payload" / "ODAFileConverter.app" / "Contents" / "MacOS" / "ODAFileConverter"),
    "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter",
    shutil.which("ODAFileConverter") or "",
]
ODA_BIN = next((p for p in ODA_PATHS if p and Path(p).exists()), None)


def convert_dwg_to_dxf(dwg_bytes: bytes, filename: str) -> str:
    """Convert a .dwg file to .dxf and return the .dxf text content."""
    if not ODA_BIN:
        raise RuntimeError(
            "ODA File Converter not found. "
            "Download free from https://www.opendesign.com/guestfiles/oda_file_converter "
            "or set ODA_CONVERTER=/path/to/binary. "
            "Alternative: export your drawing as .dxf from AutoCAD (File > Save As > DXF) "
            "and import the .dxf directly — no converter needed."
        )

    with tempfile.TemporaryDirectory(prefix="flowlytics_") as tmpdir:
        in_dir = Path(tmpdir) / "in"
        out_dir = Path(tmpdir) / "out"
        in_dir.mkdir()
        out_dir.mkdir()

        # Write the uploaded .dwg
        dwg_path = in_dir / filename
        dwg_path.write_bytes(dwg_bytes)

        # ODA File Converter CLI:
        # ODAFileConverter <input_dir> <output_dir> <output_version> <output_type> <recurse> <audit>
        # output_type: 0 = DWG, 1 = DXF, 2 = DST
        # output_version: "ACAD2018" is a safe modern default
        cmd = [ODA_BIN, str(in_dir), str(out_dir), "ACAD2018", "DXF", "0", "1"]
        result = subprocess.run(cmd, capture_output=True, timeout=60)

        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")
            raise RuntimeError(f"ODA converter failed (exit {result.returncode}): {stderr}")

        # Find the output .dxf file
        dxf_files = list(out_dir.glob("*.dxf"))
        if not dxf_files:
            raise RuntimeError("Conversion produced no .dxf output")

        return dxf_files[0].read_text(encoding="utf-8", errors="replace")


class ConvertHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path != "/convert":
            self.send_error(404)
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._error(400, "Expected multipart/form-data")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            # Parse boundary from Content-Type
            import re
            boundary_match = re.search(r'boundary=([^\s;]+)', content_type)
            if not boundary_match:
                self._error(400, "No boundary in Content-Type")
                return
            boundary = boundary_match.group(1).encode()

            # Split on boundary
            delimiter = b"--" + boundary
            parts = body.split(delimiter)

            file_data = None
            filename = "upload.dwg"

            for part in parts:
                # Skip empty parts and closing delimiter
                if not part or part.strip() == b"--" or part.strip() == b"":
                    continue
                # Find header/body separator
                sep_idx = part.find(b"\r\n\r\n")
                if sep_idx < 0:
                    continue
                header_bytes = part[:sep_idx]
                body_bytes = part[sep_idx + 4:]
                # Strip trailing \r\n
                if body_bytes.endswith(b"\r\n"):
                    body_bytes = body_bytes[:-2]

                header_str = header_bytes.decode("utf-8", errors="replace")
                if "filename=" not in header_str:
                    continue

                # Extract filename
                fn_match = re.search(r'filename="([^"]*)"', header_str)
                if fn_match:
                    filename = Path(fn_match.group(1)).name
                file_data = body_bytes
                break

            if not file_data:
                self._error(400, "No file found in request")
                return

            dxf_text = convert_dwg_to_dxf(file_data, filename)

            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(dxf_text.encode("utf-8"))

        except RuntimeError as e:
            self._error(500, str(e))
        except Exception as e:
            self._error(500, f"Unexpected error: {e}")

    def _error(self, code, message):
        self.send_response(code)
        self._cors_headers()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        print(f"[convert] {fmt % args}")


def main():
    if ODA_BIN:
        print(f"ODA File Converter: {ODA_BIN}")
    else:
        print("WARNING: ODA File Converter not found. .dwg conversion will fail.")
        print("  Install ODA File Converter or set ODA_CONVERTER=/path/to/binary")

    server = HTTPServer(("", PORT), ConvertHandler)
    print(f"DWG conversion server listening on http://localhost:{PORT}")
    print(f"  POST /convert  (multipart/form-data with .dwg file)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
