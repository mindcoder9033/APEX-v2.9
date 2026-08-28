# Live Coaching Tab Implementation Plan

## 1. Objective
Build the "Live Coaching" tab for the APEX UI. This tab serves as the control center for real-time driver feedback, combining detailed configuration settings for coaching modalities (Visual HUD, Voice, Haptic) with a live telemetry dashboard to monitor active coaching metrics and recent mistakes.

## 2. Design Decisions
Based on our Socratic Gate discussion, the following design decisions will guide the implementation:
- **Tab Purpose**: Dual-purpose interface containing both configuration settings (intensity, toggles, skill level) and a live telemetry overview.
- **Visual Coaching (HUD)**: Features an interactive preview section showing how the HUD overlay will look, with individual toggles for each visual element (Brake Point Indicator, Speed Trace, Grip Meter, etc.).
- **Voice Coaching**: Granular configuration controls including toggles for specific advice types (Braking, Throttle, Line, Warnings, Strategy), voice selection (gender/accent), and a volume slider.
- **Live Telemetry Overview**: A focused dashboard displaying a corner-by-corner live score feed, a recent mistakes log, and the current session mode / skill calibration status.

## 3. Agent Assignments
- **`@frontend-developer`**: Implement the React/UI components for the settings panel (HUD preview, toggles, sliders) and the live telemetry dashboard.
- **`@backend-architect`**: Ensure the real-time telemetry WebSocket pipeline efficiently supplies the required data (scores, mistakes) to the frontend at high frequency and persists user configuration updates.
- **`@ui-designer`**: Ensure the HUD preview and telemetry dashboard adhere to APEX's dark, premium, data-dense design system.

## 4. Task Breakdown

### Phase 1: Foundation & Layout
- [ ] Create the main `LiveCoachingTab` component structure, utilizing a split-pane or grid layout (Configuration on one side, Live Dashboard on the other).
- [ ] Implement the global "Coaching Mode" selector (Practice, Qualifying, Race, Learning) and display the current "Skill Calibration" status.

### Phase 2: Configuration Panels
- [ ] Build the "Visual HUD Settings" panel, including the interactive HUD preview component and toggle switches for individual elements.
- [ ] Build the "Voice Coaching Settings" panel with granular advice toggles, voice selector dropdown, and volume slider.
- [ ] Build the "Haptic Feedback Settings" panel with intensity sliders for specific events (wheelspin, lockup, oversteer).

### Phase 3: Live Telemetry Dashboard
- [ ] Implement the "Corner-by-Corner Feed" component to display real-time scores (0-100%) as a scrolling list or timeline.
- [ ] Implement the "Mistakes Log" component to show recent active warnings (e.g., early apex, lockup) with color-coded severity.
- [ ] Connect the dashboard components to the live telemetry data store/WebSocket.

## 5. Verification Checklist
- [ ] The tab renders correctly and matches the APEX design language.
- [ ] Toggling HUD elements dynamically updates the visual preview component.
- [ ] Voice and haptic configuration changes successfully update the application state.
- [ ] The live dashboard correctly parses and renders incoming telemetry events (corner scores, mistake flags).
- [ ] The interface remains performant and responsive even during high-frequency data updates.
