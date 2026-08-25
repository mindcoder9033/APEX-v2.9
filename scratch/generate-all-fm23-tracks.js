/**
 * APEX Track Profile Generator
 * Parses all 28+ locations and 72 layouts directly from Docs/FM23 Tracks.md,
 * and generates standardized uncalibrated JSON profiles in /data/tracks/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOC_PATH = path.resolve(__dirname, '../Docs/FM23 Tracks.md');
const DATA_DIR = path.resolve(__dirname, '../data/tracks');

export function parseTrackDoc(docContent) {
  const lines = docContent.split('\n');
  const tracks = [];
  let currentLocation = null;
  let currentCategory = 'Real Tracks';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('## Real Tracks')) {
      currentCategory = 'Real Tracks';
      continue;
    }
    if (line.startsWith('## Fictional Tracks')) {
      currentCategory = 'Fictional Tracks';
      continue;
    }

    if (line.startsWith('### ')) {
      currentLocation = line.replace('### ', '').trim();
      continue;
    }

    // Match layout line: *   **Grand Prix Circuit**: 3.916 km (2.433 mi) [[25]]
    // or *   **National Circuit Alt**: ~3.0 km
    if (line.startsWith('*') && line.includes('**') && currentLocation) {
      const match = line.match(/\*\s+\*\*([^*]+)\*\*:\s*([^[(]+)/);
      if (match) {
        const layoutName = match[1].trim();
        const rawLength = match[2].trim();

        // Extract km number
        const kmMatch = rawLength.match(/([\d.]+)\s*km/i);
        let lengthMeters = 0;
        if (kmMatch) {
          lengthMeters = Math.round(parseFloat(kmMatch[1]) * 1000);
        }

        // Infer Direction
        let direction = 'Clockwise';
        const locLower = currentLocation.toLowerCase();
        const layoutLower = layoutName.toLowerCase();

        if (layoutLower.includes('reverse')) {
          direction = 'Counter-Clockwise';
        } else if (layoutLower.includes('oval') || layoutLower.includes('speedway')) {
          direction = 'Counter-Clockwise';
        } else if (locLower.includes('laguna seca') || locLower.includes('yas marina') || locLower.includes('kyalami')) {
          direction = 'Counter-Clockwise';
        } else if (locLower.includes('daytona') || locLower.includes('homestead') || locLower.includes('sunset peninsula')) {
          direction = 'Counter-Clockwise';
        } else if (locLower.includes('indianapolis') && layoutLower.includes('brickyard')) {
          direction = 'Counter-Clockwise';
        }

        tracks.push({
          location: currentLocation,
          layout: layoutName,
          category: currentCategory,
          lengthMeters,
          rawLength,
          direction
        });
      }
    }
  }

  return tracks;
}

export function generateSlug(name, layout = '') {
  const raw = `${name} ${layout}`.toLowerCase().trim();
  return raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildTrackProfile(trackInfo, timestamp = '2026-08-25T12:00:00.000Z') {
  const id = generateSlug(trackInfo.location, trackInfo.layout);
  const lengthMeters = trackInfo.lengthMeters;

  const s1End = Math.round(lengthMeters / 3);
  const s2End = Math.round((lengthMeters / 3) * 2);
  const s3End = lengthMeters;
  const s1Length = s1End;
  const s2Length = s2End - s1End;
  const s3Length = s3End - s2End;

  return {
    id,
    name: trackInfo.location,
    layout: trackInfo.layout,
    category: trackInfo.category,
    trackOrdinal: null,
    lengthMeters,
    status: 'Uncalibrated',
    direction: trackInfo.direction,
    sectors: {
      s1End,
      s2End,
      s3End,
      s1Length,
      s2Length,
      s3Length
    },
    turns: [],
    path2D: [],
    elevation: {
      minElevation: 0,
      maxElevation: 0,
      elevationDelta: 0,
      profile: []
    },
    characteristics: {
      totalTurns: 0,
      slowCorners: 0,
      mediumCorners: 0,
      fastCorners: 0,
      longestStraight: 0,
      rhythmOverview: 'Awaiting telemetry calibration stint to extract apex geometry and rhythm profile.',
      dangerZones: [],
      overtakingZones: []
    },
    calibrationMetadata: {
      lapsUsed: 0,
      avgSpeedKph: 0,
      calibratedAt: null,
      carModel: null,
      consistencyScore: null
    },
    driverNotes: '',
    createdDate: timestamp,
    updatedDate: timestamp
  };
}

export function generateAllTracks() {
  if (!fs.existsSync(DOC_PATH)) {
    throw new Error(`Track markdown not found at ${DOC_PATH}`);
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Clear existing tracks
  const existingFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(DATA_DIR, file));
  }

  const docContent = fs.readFileSync(DOC_PATH, 'utf8');
  const tracksList = parseTrackDoc(docContent);
  const generatedProfiles = [];

  console.log(`[GENERATOR] Found ${tracksList.length} layouts across FM23 catalog.`);

  for (const trackInfo of tracksList) {
    const profile = buildTrackProfile(trackInfo);
    const filePath = path.join(DATA_DIR, `${profile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');
    generatedProfiles.push(profile);
  }

  console.log(`[GENERATOR] Successfully created ${generatedProfiles.length} track profile JSON files in ${DATA_DIR}`);
  return generatedProfiles;
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllTracks();
}
