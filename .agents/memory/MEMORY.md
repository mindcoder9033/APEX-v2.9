# Memory Index

## Project
- [project] Always create a new dedicated branch for major code changes → project-conventions.md
- [project] AG Kit only supports Gemini CLI and Google Antigravity (not other AI coding tools) → project-conventions.md
- [project] Component metadata uses SemVer while toolkit releases use CalVer → tech-decisions.md
- [project] Analysis modules needed by the browser MUST exist in BOTH src/analysis/ (Node.js) AND public/js/analysis/ (browser-served). Copy with: Copy-Item src/analysis/[file].js public/js/analysis/[file].js. Imports in public/js/*.js always use './analysis/[file].js' (never '../analysis/'). → project-conventions.md
