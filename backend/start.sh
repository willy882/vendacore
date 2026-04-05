#!/bin/sh
# Intenta ambas rutas posibles de compilación
if [ -f "dist/main.js" ]; then
  exec node dist/main
elif [ -f "dist/src/main.js" ]; then
  exec node dist/src/main
else
  echo "ERROR: No se encontró dist/main.js ni dist/src/main.js"
  ls -la dist/ 2>/dev/null || echo "dist/ no existe"
  exit 1
fi
