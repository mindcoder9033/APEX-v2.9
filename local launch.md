 How to Launch & Test
Start the APEX Server (Web UI + Bridge):

powershell

npm start
Open http://localhost:3000 in your browser.

Start Mock Telemetry Stream (in a separate terminal):

powershell

npm run mock:stream
Watch the live telemetry HUD, G-G canvas, and shift lights respond at 60Hz.

Run Test Suite:

powershell

npm test