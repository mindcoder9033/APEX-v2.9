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

### 2.1 Primary Palette

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│  ● BLACK        #000000   RGB(0, 0, 0)      Primary background, text          │
│  ● DARK GRAY    #1A1A1A   RGB(26, 26, 26)   Card backgrounds, panels          │
│  ● MID GRAY     #2A2A2A   RGB(42, 42, 42)   Borders, dividers                 │
│  ● LIGHT GRAY   #3A3A3A   RGB(58, 58, 58)   Inputs, hover states              │
│  ● TEXT GRAY    #8A8A8A   RGB(138, 138, 138) Secondary text                  │
│  ● TEXT WHITE   #FFFFFF   RGB(255, 255, 255) Primary text                    │
│                                                                                   │
│  ● F1 RED       #E10600   RGB(225, 6, 0)     Primary accent, CTA buttons      │
│  ● F1 RED DARK  #B80500   RGB(184, 5, 0)     Button hover                     │
│  ● F1 RED GLOW  rgba(225,6,0,0.15)           Subtle glow effects              │
│  ● F1 RED DIM   rgba(225,6,0,0.3)            Dim accent elements             │
│                                                                                   │
│  ● SUCCESS      #00CC66   RGB(0, 204, 102)   Connected status                 │
│  ● WARNING      #FFCC00   RGB(255, 204, 0)   Connecting status               │
│  ● ERROR        #FF3333   RGB(255, 51, 51)   Disconnected status              │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Color Usage Rules

| Element | Color | Hex | Notes |
|---------|-------|-----|-------|
| Page Background | Black | #000000 | Full page, no gradient |
| Card Background | Dark Gray | #1A1A1A | 8px border-radius |
| Primary Text | White | #FFFFFF | Headers, labels |
| Secondary Text | Text Gray | #8A8A8A | Descriptions, metadata |
| Primary CTA | F1 Red | #E10600 | Start Recording button |
| Secondary CTA | Dark Gray | #2A2A2A | Save Settings button |
| Status Connected | Success | #00CC66 | With subtle pulse glow |
| Status Disconnected | Error | #FF3333 | Static indicator |
| Status Connecting | Warning | #FFCC00 | Pulsing animation |
| Dividers | Mid Gray | #2A2A2A | 1px solid |
| Input Fields | Light Gray | #3A3A3A | Focus: F1 Red border |
| Border Accents | F1 Red Dim | rgba(225,6,0,0.3) | Subtle edge glow |

### 2.3 Glow Effects

```css
/* Status indicator glow */
.glow-success {
    box-shadow: 0 0 20px rgba(0, 204, 102, 0.3);
}

.glow-error {
    box-shadow: 0 0 20px rgba(255, 51, 51, 0.3);
}

.glow-warning {
    box-shadow: 0 0 20px rgba(255, 204, 0, 0.3);
}

/* F1 Red glow accent */
.glow-red-subtle {
    box-shadow: 0 0 30px rgba(225, 6, 0, 0.05);
}

/* Panel separator glow */
.separator-glow {
    height: 1px;
    background: linear-gradient(
        to right,
        transparent,
        rgba(225, 6, 0, 0.3) 20%,
        rgba(225, 6, 0, 0.3) 80%,
        transparent
    );
    margin: 20px 0;
}
```

---

## 3. Typography

### 3.1 Font Family

```css
:root {
    --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                     'Helvetica Neue', Arial, sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

### 3.2 Type Scale

```css
:root {
    /* Display */
    --text-display: 48px;      /* Main title */
    --text-hero: 32px;         /* Section titles */
    --text-headline: 24px;     /* Panel titles */
    --text-title: 18px;        /* Card titles */
    
    /* Body */
    --text-body: 14px;         /* Standard text */
    --text-small: 12px;        /* Secondary info */
    --text-tiny: 10px;         /* Labels, metrics */
    
    /* Monospace */
    --text-mono: 14px;         /* Telemetry data, times */
    --text-mono-small: 12px;   /* Status data */
}
```

### 3.3 Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Subtle labels, secondary |
| Regular | 400 | Body text, descriptions |
| Medium | 500 | Subheaders, stats |
| Semibold | 600 | Primary labels, metrics |
| Bold | 700 | CTAs, headers |
| Black | 900 | Brand name, display text |

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

## 6. Animation & Motion

### 6.1 Animation Principles

- **Purposeful**: Animations communicate state changes
- **Fast**: 150-300ms duration for immediate feedback
- **Subtle**: No jarring or excessive motion
- **F1-inspired**: Snappy, precise, like a gear change

### 6.2 Animation Specifications

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Status dot pulse | Opacity + box-shadow | 2s | ease-in-out |
| Connecting pulse | Scale + opacity | 1s | ease-in-out |
| Button hover | Scale + background | 0.2s | cubic-bezier(0.25, 0.46, 0.45, 0.94) |
| Button active | Scale | 0.1s | ease-out |
| Panel transition | Opacity | 0.3s | ease |
| Status bar update | Opacity | 0.2s | ease |
| Number increment | Counter animation | 0.3s | ease-out |

### 6.3 Status Bar Animation

```css
.status-bar {
    background: var(--dark-gray);
    padding: 12px 20px;
    border: 1px solid var(--mid-gray);
    font-size: 12px;
    color: var(--text-gray);
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.3s ease;
}

.status-bar .status-icon {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--text-gray);
}

.status-bar .status-icon.recording {
    background: var(--f1-red);
    animation: blink-recording 1s ease-in-out infinite;
}

@keyframes blink-recording {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
}

.status-bar .status-icon.success {
    background: var(--success);
}

.status-bar .status-icon.error {
    background: var(--error);
}

.status-bar .status-icon.warning {
    background: var(--warning);
    animation: pulse-warning 1s ease-in-out infinite;
}
```

---

## 7. Micro-interactions

### 7.1 Button Hover States

```css
.btn-primary:hover:not(:disabled) {
    background: var(--f1-red-dark);
    transform: scale(1.02);
    box-shadow: 0 0 30px rgba(225, 6, 0, 0.2);
}

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