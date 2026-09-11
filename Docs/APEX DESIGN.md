# APEX DESIGN.md

# APEX: Racing Telemetry Analysis Tool
## Design System & UI Specifications

---

## 1. Design Philosophy

### 1.1 Core Principles
- **Pitch Black**: OLED-optimized pure black background for maximum contrast and minimal eye strain
- **Racing Heritage**: F1-inspired red accents that evoke speed, precision, and motorsport tradition
- **Geometry**: Sharp, aggressive 45° cuts that communicate precision engineering
- **Clarity**: Information hierarchy that prioritizes action and status at a glance
- **Performance**: Visual design that mirrors the speed and efficiency of the tool itself

### 1.2 Design Influences
- Formula 1 timing screens
- Motorsport telemetry displays
- Racing car instrument clusters
- Pit wall command centers
- Modern F1 livery design

---

## 2. Color System

### 2.1 Primary Palette (Deep Pitwall Obsidian Theme)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│  ● PITCH BLACK   #000000   RGB(0, 0, 0)      Primary background (OLED base)    │
│  ● COCKPIT CARBON#0D0F12   RGB(13, 15, 18)   Card backgrounds, panels          │
│  ● OBSIDIAN ELEV #13171F   RGB(19, 23, 31)   Elevated panels, containers       │
│  ● SURFACE POPOVER#1A202C  RGB(26, 32, 44)   Popovers, modals, dropdowns       │
│  ● INPUT SURFACE #161B22   RGB(22, 27, 34)   Inputs, form elements             │
│  ● HAIRLINE BORDER rgba(255,255,255,0.08)    Subtle technical component borders│
│  ● BORDER BRIGHT #222936   RGB(34, 41, 54)   Active / focused panel borders    │
│  ● TEXT WHITE    #FFFFFF   RGB(255, 255, 255) Primary telemetry & headers       │
│  ● TEXT MUTED    #94A3B8   RGB(148, 163, 184) Secondary labels, units          │
│  ● TEXT SUBTLE   #64748B   RGB(100, 116, 139) Disabled / background metadata   │
│                                                                                   │
│  ● F1 RED        #E10600   RGB(225, 6, 0)     Primary accent, CTA buttons      │
│  ● F1 RED DARK   #B80500   RGB(184, 5, 0)     Button hover                     │
│  ● F1 RED GLOW   rgba(225,6,0,0.25)           Telemetry active trace glow      │
│  ● F1 RED SUBTLE rgba(225,6,0,0.08)           Background highlight tint        │
│                                                                                   │
│  ● APEX GOLD     #FFB800   RGB(255, 184, 0)   Coach insights, potential gains  │
│  ● ELECTRIC CYAN #00E5FF   RGB(0, 229, 255)   Telemetry channels, trace data   │
│                                                                                   │
│  ● FIA SUCCESS   #00E676   RGB(0, 230, 118)   Positive delta, connected        │
│  ● FIA WARNING   #FF9500   RGB(255, 149, 0)   Caution, connecting status       │
│  ● FIA ERROR     #FF3B30   RGB(255, 59, 48)   Negative delta, disconnected     │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Color Usage Rules

| Element | Color | Hex / RGBA | Notes |
|---------|-------|------------|-------|
| Page Canvas | Pitch Black | #000000 | Pure OLED black base |
| Card / Panel | Cockpit Carbon | #0D0F12 | Hairline border `rgba(255,255,255,0.08)` |
| Elevated Module | Obsidian Elev | #13171F | Chamfer-cut containers |
| Primary Text | White | #FFFFFF | Headers, active stats |
| Secondary Text | Text Slate | #94A3B8 | Unit markers, field labels |
| Tertiary Text | Text Subdued | #64748B | Metadata, timestamps |
| Primary CTA | F1 Red | #E10600 | Start Recording / Live Action |
| Secondary CTA | Input Surface | #161B22 | Border: #222936 |
| Positive Delta / Gain | FIA Emerald | #00E676 | Gained time / Optimal sector |
| Negative Delta / Loss | FIA Crimson | #FF3B30 | Lost time / Oversteer event |
| Coach Recommendation | Apex Gold | #FFB800 | Potential lap time gain |
| Telemetry Trace | Electric Cyan | #00E5FF | Speed, steering & G-force curves |

---

## 3. Typography

### 3.1 Font Suite (Sharp Cockpit + Utilitarian UI + Tabular Monospace)

```css
:root {
    /* Display / Headers: Sharp angular motorsport cockpit styling */
    --font-display: 'Chakra Petch', 'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    
    /* Body / UI: Clean, legible utilitarian grotesque */
    --font-sans: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    
    /* Monospace / Telemetry: High-precision tabular data with ligatures */
    --font-mono: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
}
```

### 3.2 Type Scale

```css
:root {
    /* Display */
    --text-display: 48px;      /* Main hero / lap times */
    --text-hero: 32px;         /* Section titles */
    --text-headline: 24px;     /* Panel titles */
    --text-title: 18px;        /* Card titles */
    
    /* Body */
    --text-body: 14px;         /* Standard UI text */
    --text-small: 12px;        /* Secondary labels */
    --text-tiny: 10px;         /* Technical badges & metadata */
    
    /* Monospace */
    --text-mono: 14px;         /* Telemetry data, split times */
    --text-mono-small: 11px;   /* Status telemetry logs */
}
```

### 3.3 Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Secondary descriptions, subtle telemetry notes |
| Regular | 400 | Body text, UI descriptions |
| Medium | 500 | Tab navigation, badges, subheadings |
| Semibold | 600 | Primary labels, button text, table headers |
| Bold | 700 | Display numbers, lap deltas, brand title |

### 3.4 Letter Spacing

```css
:root {
    --tracking-tight: -0.02em;   /* Headers, CTAs */
    --tracking-normal: 0em;      /* Body text */
    --tracking-wide: 0.05em;     /* Labels, uppercase */
    --tracking-mono: 0.04em;     /* Telemetry data */
}
```

---

## 4. Component Design

### 4.1 Buttons

#### Primary CTA (Start Recording)

```
┌──────────────────────────────┐
│  ⏺  START RECORDING          │  ← 45° cut on bottom-right corner
└──────────────────────────────┘

Properties:
- Background: F1 Red (#E10600)
- Text: White, uppercase, 14px, bold, tracking-wide
- Height: 56px
- Padding: 0 32px
- Border: none
- Hover: F1 Red Dark (#B80500), scale 1.02
- Active: scale 0.98
- Disabled: opacity 0.3, cursor not-allowed
- Corner cut: 45° angle, 12px cut
```

#### Secondary Button (Save Settings)

```
┌──────────────────────────────┐
│  SAVE SETTINGS                │  ← 45° cut on bottom-left corner
└──────────────────────────────┘

Properties:
- Background: Mid Gray (#2A2A2A)
- Text: White, uppercase, 12px, medium
- Height: 40px
- Padding: 0 20px
- Border: 1px solid F1 Red Dim (rgba(225,6,0,0.3))
- Hover: Light Gray (#3A3A3A), border F1 Red
- Corner cut: 45° angle, 8px cut
```

#### Danger Button (Stop Recording)

```
┌──────────────────────────────┐
│  ■  STOP RECORDING            │  ← 45° cut on bottom-right corner
└──────────────────────────────┘

Properties:
- Background: transparent
- Text: Error Red (#FF3333), uppercase, 14px, bold
- Height: 56px
- Padding: 0 32px
- Border: 1px solid Error Red (#FF3333)
- Hover: Background Error Red, Text White
- Corner cut: 45° angle, 12px cut
```

### 4.2 Button CSS Implementation

```css
/* Base button with 45° corner cut */
.btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: var(--font-primary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    border: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    outline: none;
    clip-path: polygon(
        0 0,
        100% 0,
        100% calc(100% - var(--cut-size)),
        calc(100% - var(--cut-size)) 100%,
        0 100%
    );
}

.btn-primary {
    background: var(--f1-red);
    color: var(--text-white);
    height: 56px;
    padding: 0 32px;
    font-size: 14px;
    --cut-size: 12px;
}

.btn-primary:hover:not(:disabled) {
    background: var(--f1-red-dark);
    transform: scale(1.02);
}

.btn-primary:active:not(:disabled) {
    transform: scale(0.98);
}

.btn-primary:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
}

.btn-secondary {
    background: var(--mid-gray);
    color: var(--text-white);
    height: 40px;
    padding: 0 20px;
    font-size: 12px;
    font-weight: 500;
    --cut-size: 8px;
    border: 1px solid var(--f1-red-dim);
}

.btn-secondary:hover {
    background: var(--light-gray);
    border-color: var(--f1-red);
}

.btn-danger {
    background: transparent;
    color: var(--error);
    height: 56px;
    padding: 0 32px;
    font-size: 14px;
    --cut-size: 12px;
    border: 1px solid var(--error);
}

.btn-danger:hover:not(:disabled) {
    background: var(--error);
    color: var(--text-white);
}

.btn-danger:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* 45° cut on bottom-left corner variation */
.btn-cut-left {
    clip-path: polygon(
        var(--cut-size) 0,
        100% 0,
        100% 100%,
        0 100%,
        0 var(--cut-size)
    );
}

/* 45° cut on all corners variation */
.btn-cut-all {
    clip-path: polygon(
        var(--cut-size) 0,
        calc(100% - var(--cut-size)) 0,
        100% var(--cut-size),
        100% calc(100% - var(--cut-size)),
        calc(100% - var(--cut-size)) 100%,
        var(--cut-size) 100%,
        0 calc(100% - var(--cut-size)),
        0 var(--cut-size)
    );
}
```

### 4.3 Status Indicator

```
●  CONNECTED
   └── 12px circle
   └── Success Green (#00CC66)
   └── Soft pulse glow animation
   └── 45° cut on indicator's parent container

●  DISCONNECTED
   └── 12px circle
   └── Error Red (#FF3333)
   └── Static, no animation

●  CONNECTING
   └── 12px circle
   └── Warning Yellow (#FFCC00)
   └── Pulsing animation (1s loop)
```

```css
.status-indicator {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 16px 4px 12px;
    background: var(--dark-gray);
    border: 1px solid var(--mid-gray);
    clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
}

.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}

.status-dot.connected {
    background: var(--success);
    box-shadow: 0 0 20px rgba(0, 204, 102, 0.3);
    animation: pulse-success 2s ease-in-out infinite;
}

.status-dot.disconnected {
    background: var(--error);
    box-shadow: 0 0 20px rgba(255, 51, 51, 0.3);
}

.status-dot.connecting {
    background: var(--warning);
    box-shadow: 0 0 20px rgba(255, 204, 0, 0.3);
    animation: pulse-warning 1s ease-in-out infinite;
}

@keyframes pulse-success {
    0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(0, 204, 102, 0.3); }
    50% { opacity: 0.7; box-shadow: 0 0 30px rgba(0, 204, 102, 0.5); }
}

@keyframes pulse-warning {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.9); }
}
```

### 4.4 Input Fields

```
┌──────────────────────────────────────────────┐
│  SESSION NAME                                │
│  [ My Qualifying Stint        ]              │
└──────────────────────────────────────────────┘

Properties:
- Label: Uppercase, Text Gray (#8A8A8A), 10px, tracking-wide
- Input: Background Light Gray (#3A3A3A)
- Input Text: White, 14px
- Border: 1px solid Mid Gray (#2A2A2A)
- Border Radius: none (straight edges)
- Focus: 1px solid F1 Red (#E10600)
- Height: 44px
- Padding: 0 14px
- Corner cut: 45° cut on bottom-right corner
```

```css
.input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.input-group label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--text-gray);
    font-weight: 600;
}

.input-group input {
    height: 44px;
    padding: 0 14px;
    background: var(--light-gray);
    border: 1px solid var(--mid-gray);
    color: var(--text-white);
    font-size: 14px;
    font-family: var(--font-primary);
    transition: border-color 0.2s;
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%);
}

.input-group input:focus {
    outline: none;
    border-color: var(--f1-red);
    box-shadow: 0 0 0 1px var(--f1-red);
}

.input-group input::placeholder {
    color: var(--text-gray);
    opacity: 0.5;
}
```

### 4.5 Panels / Cards

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  ●  CONNECTED    Source: 192.168.1.100:9999                 │
│                                                               │
│  ═══════════════════════════════════════════════════════════  │
│                                                               │
│  SESSION NAME                      UDP PORT                  │
│  [ My Qualifying Stint   ]         [ 9999 ]    [ SAVE ]     │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⏺  START RECORDING     ■  STOP RECORDING              │  │
│  │                                                         │  │
│  │  LAPS     TIME                BEST LAP                  │  │
│  │  12       00:02:37.213       02:13.742                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ●  Recording Lap 7... Press STOP to generate report.        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

```css
.panel {
    background: var(--dark-gray);
    border: 1px solid var(--mid-gray);
    padding: 20px 24px;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    position: relative;
}

/* Subtle red accent line at top of panels */
.panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
        to right,
        transparent 0%,
        var(--f1-red) 20%,
        var(--f1-red) 80%,
        transparent 100%
    );
}

/* Optional: 45° cut on panel corners (subtle) */
.panel-cut {
    clip-path: polygon(
        8px 0,
        calc(100% - 8px) 0,
        100% 8px,
        100% 100%,
        0 100%,
        0 8px
    );
}
```

### 4.6 Stats Display

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  LAPS                          TIME                          │
│  12                            00:02:37.213                  │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  BEST LAP                     SESSION                        │
│  02:13.742                    My Qualifying Stint            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

```css
.stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.stat-item .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--text-gray);
    font-weight: 600;
}

.stat-item .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-white);
    font-family: var(--font-mono);
    letter-spacing: var(--tracking-mono);
}

.stat-item .stat-value.highlight {
    color: var(--f1-red);
}

.stat-item .stat-value.lap-number {
    color: var(--f1-red);
    font-size: 28px;
}

.stat-separator {
    border: none;
    height: 1px;
    background: linear-gradient(
        to right,
        transparent,
        var(--mid-gray) 20%,
        var(--mid-gray) 80%,
        transparent
    );
    margin: 16px 0;
}
```

---

## 5. Layout Design

### 5.1 Page Layout

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │  APEX                                    Racing Telemetry Analysis │  ║
║  │  ────────────────────────────────────────────────────────────────── │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │  ●  CONNECTED                Source: 192.168.1.100:9999            │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │  SESSION NAME                          UDP PORT                    │  ║
║  │  [ My Qualifying Stint        ]        [ 9999 ]    [ SAVE ]        │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │  ┌────────────────────────────────────┐  ┌─────────────────────────┐ │  ║
║  │  │  ⏺  START RECORDING                │  │  ■  STOP RECORDING      │ │  ║
║  │  └────────────────────────────────────┘  └─────────────────────────┘ │  ║
║  │                                                                       │  ║
║  │  ┌────────────┬────────────────────┬─────────────────────────────┐  │  ║
║  │  │  LAPS      │  TIME              │  BEST LAP                   │  │  ║
║  │  │  12        │  00:02:37.213      │  02:13.742                  │  │  ║
║  │  └────────────┴────────────────────┴─────────────────────────────┘  │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │  ●  Recording Lap 7... Press STOP to generate report.              │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │  APEX v1.0.0                    Self-hosted · No external          │  ║
║  │                                  dependencies                       │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 5.2 Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Desktop | ≥ 1024px | Full layout, horizontal stat grid |
| Tablet | 768px - 1023px | Stacked panels, 2-column stats |
| Mobile | < 768px | Full stack, 1-column stats, full-width buttons |

### 5.3 Mobile Layout

```
╔═══════════════════════════════════════╗
║                                       ║
║  APEX                                ║
║  Racing Telemetry Analysis           ║
║  ──────────────────────────────────── ║
║                                       ║
║  ● CONNECTED                         ║
║  192.168.1.100:9999                  ║
║                                       ║
║  ──────────────────────────────────── ║
║                                       ║
║  SESSION NAME                        ║
║  [ My Qualifying Stint ]             ║
║                                       ║
║  UDP PORT              [ SAVE ]     ║
║  [ 9999 ]                            ║
║                                       ║
║  ┌─────────────────────────────────┐ ║
║  │  ⏺ START RECORDING              │ ║
║  └─────────────────────────────────┘ ║
║  ┌─────────────────────────────────┐ ║
║  │  ■ STOP RECORDING               │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
║  LAPS     12                         ║
║  TIME     00:02:37.213               ║
║  BEST     02:13.742                  ║
║                                       ║
║  ● Recording Lap 7...                ║
║                                       ║
║  APEX v1.0.0                         ║
║  Self-hosted                         ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

## 6. Animation & Motion (Emil Kowalski Design Engineering)

### 6.1 Motion Principles
- **Unseen details compound**: Animations should feel physical, tactile, and natural without drawing attention away from telemetry analysis.
- **Sub-300ms Rule**: All UI transitions must complete in under 250ms (button press: 140ms, popovers: 180ms, modals: 240ms).
- **GPU-Accelerated**: Only animate `transform` and `opacity`. Never animate `width`, `height`, `margin`, or `padding`.
- **Zero Animation on High-Frequency Loops**: Live telemetry data feeds and keyboard-initiated triggers update with zero latency (0ms).
- **Tactile Response**: Buttons and actionable elements depress subtly on press (`scale(0.97)` on `:active`) to confirm user input.

### 6.2 Custom Easing Curves & Timing Tokens

```css
:root {
  /* Strong ease-out for immediate UI responsiveness */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  /* Strong ease-in-out for layout morphing */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

  /* iOS / Drawer physics curve */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  /* Micro-timing specs */
  --dur-press: 140ms;
  --dur-popover: 180ms;
  --dur-modal: 240ms;
}
```

### 6.3 Animation Specifications

| Element | Properties Animated | Duration | Easing | Rationale |
|---------|---------------------|----------|--------|-----------|
| Button Press (:active) | `transform: scale(0.97)` | 140ms | `--ease-out` | Tactile feedback confirms click immediately |
| Button Hover | `transform: translateY(-1px)` | 150ms | `--ease-out` | Subtle lift on mouse hover |
| Status Dot Pulse | `opacity`, `box-shadow` | 2s | `--ease-in-out` | Gentle breathing state indicator |
| Recording Blink | `opacity` | 1s | linear | High-visibility telemetry recording confirmation |
| Modal / Popover Open | `transform: scale(0.96)`, `opacity` | 180-240ms | `--ease-out` | Enters with origin-awareness, never `scale(0)` |

---

## 7. Micro-interactions & Tactile Feedback

### 7.1 Button Press & Hover States

```css
.btn {
    transition: transform var(--dur-press) var(--ease-out),
                background-color 140ms ease,
                border-color 140ms ease,
                box-shadow 140ms ease;
    will-change: transform;
}

@media (hover: hover) and (pointer: fine) {
    .btn:hover {
        transform: translateY(-1px) scale(1.015);
    }
}

.btn:active {
    transform: scale(0.97);
}
```

.btn-primary:active:not(:disabled) {
    transform: scale(0.98);
    box-shadow: none;
}
```

### 7.2 Input Focus States

```css
.input-group input:focus {
    outline: none;
    border-color: var(--f1-red);
    box-shadow: 0 0 0 1px var(--f1-red), 0 0 20px rgba(225, 6, 0, 0.05);
}

.input-group input:hover {
    border-color: var(--light-gray);
}
```

### 7.3 Status Dot Transitions

```css
.status-dot {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.status-dot.connected {
    background: var(--success);
    box-shadow: 0 0 20px rgba(0, 204, 102, 0.3);
}

.status-dot.disconnected {
    background: var(--error);
    box-shadow: 0 0 20px rgba(255, 51, 51, 0.3);
}

.status-dot.connecting {
    background: var(--warning);
    box-shadow: 0 0 20px rgba(255, 204, 0, 0.3);
}
```

---

## 8. Assets & Icons

### 8.1 Custom Icons (SVG)

```svg
<!-- Start Recording Icon -->
<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" fill="currentColor"/>
</svg>

<!-- Stop Recording Icon -->
<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="3" width="10" height="10" fill="currentColor"/>
</svg>

<!-- Connected Status Icon -->
<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="5" fill="currentColor"/>
</svg>

<!-- APEX Logo Mark -->
<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M2 32L16 2L30 32L18 18L14 18L2 32Z" fill="#E10600"/>
    <path d="M8 32L16 16L24 32L18 24L14 24L8 32Z" fill="#FFFFFF"/>
</svg>
```

### 8.2 Icon Usage

| Icon | Usage | Size | Color |
|------|-------|------|-------|
| Circle | Start Recording | 16x16 | White |
| Square | Stop Recording | 16x16 | Error Red |
| Dot | Status indicators | 12x12 | Dynamic |
| Logo | Header | 32x32 | F1 Red + White |

### 8.3 Favicon

```html
<!-- 45° cut design favicon -->
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
```

---

## 9. CSS Variables Reference

```css
:root {
    /* Colors */
    --black: #000000;
    --dark-gray: #1A1A1A;
    --mid-gray: #2A2A2A;
    --light-gray: #3A3A3A;
    --text-gray: #8A8A8A;
    --text-white: #FFFFFF;
    
    --f1-red: #E10600;
    --f1-red-dark: #B80500;
    --f1-red-glow: rgba(225, 6, 0, 0.15);
    --f1-red-dim: rgba(225, 6, 0, 0.3);
    
    --success: #00CC66;
    --warning: #FFCC00;
    --error: #FF3333;
    
    /* Typography */
    --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                     'Helvetica Neue', Arial, sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    
    --text-display: 48px;
    --text-hero: 32px;
    --text-headline: 24px;
    --text-title: 18px;
    --text-body: 14px;
    --text-small: 12px;
    --text-tiny: 10px;
    --text-mono: 14px;
    --text-mono-small: 12px;
    
    --tracking-tight: -0.02em;
    --tracking-normal: 0em;
    --tracking-wide: 0.05em;
    --tracking-mono: 0.04em;
    
    /* Spacing */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
    --space-2xl: 48px;
    
    /* Border */
    --border-radius: 0px;
    --border-width: 1px;
    
    /* Shadows */
    --shadow-glow: 0 0 30px rgba(225, 6, 0, 0.05);
    --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.3);
}
```

---

## 10. Accessibility

### 10.1 Contrast Ratios

| Element | Colors | Contrast Ratio | WCAG Level |
|---------|--------|---------------|------------|
| Primary Text | White on Black | 21:1 | AAA |
| Secondary Text | #8A8A8A on Black | 9.4:1 | AAA |
| F1 Red Button | #E10600 on Black | 4.8:1 | AA |
| Error Text | #FF3333 on Black | 6.2:1 | AA |
| Success Dot | #00CC66 on Black | 5.1:1 | AA |
| Input Text | White on #3A3A3A | 11.6:1 | AAA |

### 10.2 Focus States

```css
*:focus-visible {
    outline: 2px solid var(--f1-red);
    outline-offset: 2px;
}

.btn:focus-visible {
    outline: 2px solid var(--f1-red);
    outline-offset: 4px;
}

input:focus-visible {
    outline: 2px solid var(--f1-red);
    outline-offset: 0px;
}
```

### 10.3 Keyboard Navigation

- Tab order: Connection status → Session name → UDP port → Save → Start → Stop
- Enter/Space to activate buttons
- Escape to cancel operations
- All interactive elements are focusable

---

## 11. Responsive Design Implementation

### 11.1 Desktop-First Approach

```css
/* Desktop (≥ 1024px) - default styles */
.panel {
    padding: 20px 24px;
}

.stats-grid {
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
}

.controls-row {
    display: flex;
    gap: 16px;
    align-items: center;
}

/* Tablet (768px - 1023px) */
@media (max-width: 1023px) {
    .panel {
        padding: 16px 20px;
    }
    
    .stats-grid {
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    
    .controls-row {
        flex-wrap: wrap;
    }
}

/* Mobile (< 768px) */
@media (max-width: 767px) {
    body {
        padding: 12px;
    }
    
    .panel {
        padding: 12px 16px;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
        gap: 8px;
    }
    
    .controls-row {
        flex-direction: column;
        width: 100%;
    }
    
    .controls-row .btn {
        width: 100%;
        justify-content: center;
    }
    
    header h1 {
        font-size: 24px;
    }
    
    header .subtitle {
        font-size: 12px;
        display: block;
    }
    
    .stat-item .stat-value {
        font-size: 20px;
    }
    
    .settings-row {
        flex-direction: column;
        gap: 12px;
    }
    
    .input-group {
        width: 100%;
    }
    
    .input-group input {
        width: 100%;
    }
}
```

---

## 12. Design Deliverables Checklist

### 12.1 Required Assets
- [ ] Logo (SVG + PNG)
- [ ] Favicon (SVG + ICO)
- [ ] Icon set (SVG)
- [ ] Font files (Inter + JetBrains Mono)
- [ ] OG Image (1200x630)
- [ ] Screenshot (Full page)

### 12.2 Documentation
- [x] Design System (this document)
- [ ] Component Library (Storybook/Playground)
- [ ] Accessibility Audit
- [ ] Brand Guidelines

---

**Document Version**: 1.0.0
**Status**: Draft
**Last Updated**: 2026-08-23
**Author**: APEX Design Team