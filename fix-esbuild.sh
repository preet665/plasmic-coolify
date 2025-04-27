#!/bin/bash

# Path to esbuild.js
ESBUILD_FILE="platform/canvas-packages/esbuild.js"

# Check if file exists
if [ ! -f "$ESBUILD_FILE" ]; then
  echo "Error: $ESBUILD_FILE not found"
  exit 1
fi

# Create backup
cp "$ESBUILD_FILE" "${ESBUILD_FILE}.bak"
echo "Created backup at ${ESBUILD_FILE}.bak"

# Fix the syntax error by uncommenting the fs.watch line
sed -i 's/\/\/ fs.watch(srcDir, { recursive: true }, (eventType, filename) =>/fs.watch(srcDir, { recursive: true }, (eventType, filename) =>/' "$ESBUILD_FILE"

# Make sure there's only one closing bracket
# Find the line number of "if (filename) {"
LINE_NUM=$(grep -n "if (filename) {" "$ESBUILD_FILE" | cut -d: -f1)

# Check the next few lines for closing brackets and handle appropriately
NEXT_LINES=$(tail -n +$LINE_NUM "$ESBUILD_FILE" | head -n 10)
if echo "$NEXT_LINES" | grep -q "});"; then
  # If we find a standalone closing bracket and semicolon
  sed -i '/^    });$/d' "$ESBUILD_FILE"
fi

echo "Fixed esbuild.js file"
echo "You can now run: ESBUILD_WATCH=true node ./platform/canvas-packages/esbuild.js" 