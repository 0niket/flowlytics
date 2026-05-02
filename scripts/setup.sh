#!/bin/bash
# Flowlytics setup script
# Checks dependencies and guides installation

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=== Flowlytics Setup ==="
echo ""

# 1. Python
echo -n "Python 3 .......... "
if command -v python3 &>/dev/null; then
    echo -e "${GREEN}$(python3 --version)${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "  Install Python 3: https://www.python.org/downloads/"
fi

# 2. pip packages for DXF extraction (optional)
echo -n "ezdxf (pip) ....... "
if python3 -c "import ezdxf" 2>/dev/null; then
    echo -e "${GREEN}installed${NC}"
else
    echo -e "${YELLOW}not installed (optional — needed for scripts/cad/dxf_inventory.py)${NC}"
    echo "  Install: pip3 install ezdxf"
fi

# 3. ODA File Converter (optional — for .dwg support)
echo -n "ODA Converter ..... "
ODA_PATHS=(
    "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter"
    "$(dirname "$0")/../tools/oda_file_converter_pkg/Payload/ODAFileConverter.app/Contents/MacOS/ODAFileConverter"
)
ODA_FOUND=""
for p in "${ODA_PATHS[@]}"; do
    if [ -f "$p" ]; then
        ODA_FOUND="$p"
        break
    fi
done
if [ -n "$(command -v ODAFileConverter 2>/dev/null)" ]; then
    ODA_FOUND="$(command -v ODAFileConverter)"
fi

if [ -n "$ODA_FOUND" ]; then
    echo -e "${GREEN}found at ${ODA_FOUND}${NC}"
else
    echo -e "${YELLOW}not found (optional — needed for .dwg file conversion)${NC}"
    echo ""
    echo "  The ODA File Converter converts .dwg files to .dxf."
    echo "  Without it, users can still import .dxf files directly (AutoCAD: File → Save As → DXF)."
    echo ""
    echo "  To install:"
    echo "    1. Download from: https://www.opendesign.com/guestfiles/oda_file_converter"
    echo "       (free registration required)"
    echo "    2. macOS: Install the .pkg — it goes to /Applications/ODAFileConverter.app"
    echo "    3. Linux: Install the .deb/.rpm package"
    echo "    4. Or set ODA_CONVERTER=/path/to/binary in your environment"
    echo ""
fi

# 4. Summary
echo ""
echo "=== How to run ==="
echo ""
echo "  Web app (required):"
echo "    python3 -m http.server 8000"
echo "    Open http://localhost:8000/web/"
echo ""
echo "  DWG conversion server (optional — only for .dwg files):"
echo "    python3 scripts/serve_convert.py"
echo ""
echo "  The web app works fully without the conversion server."
echo "  Users can import .dxf files directly or use the synthetic layout."
echo ""
