/**
 * APEX Weather Conditions Matrix (18 Forza Motorsport 2023 Presets)
 * Simulates and calculates physical grip modifiers, optimum tire pressure deltas,
 * brake balance bias, and wet-line adaptation guidelines.
 */

export const FORZA_18_WEATHER_PRESETS = [
  { id: 'dry-clear-day', name: 'Clear (Day)', gripCoeff: 1.00, trackTempC: 28, airTempC: 22, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: 0.0 },
  { id: 'dry-clear-noon', name: 'Clear (Noon)', gripCoeff: 1.00, trackTempC: 35, airTempC: 28, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: -0.5 },
  { id: 'dry-clear-sunset', name: 'Clear (Sunset)', gripCoeff: 0.98, trackTempC: 22, airTempC: 18, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: +0.5 },
  { id: 'dry-clear-night', name: 'Clear (Night)', gripCoeff: 0.96, trackTempC: 15, airTempC: 12, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: +1.0 },
  { id: 'dry-partly-cloudy', name: 'Partly Cloudy', gripCoeff: 0.99, trackTempC: 26, airTempC: 20, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: 0.0 },
  { id: 'dry-cloudy', name: 'Cloudy', gripCoeff: 0.98, trackTempC: 23, airTempC: 19, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: +0.5 },
  { id: 'dry-overcast', name: 'Overcast', gripCoeff: 0.97, trackTempC: 20, airTempC: 17, rainIntensity: 0.0, wetLineNeeded: false, tirePressureDeltaPsi: +0.8 },
  { id: 'dry-fog', name: 'Fog (Cool Surface)', gripCoeff: 0.93, trackTempC: 14, airTempC: 11, rainIntensity: 0.05, wetLineNeeded: false, tirePressureDeltaPsi: +1.5 },
  { id: 'dry-dense-fog', name: 'Dense Fog', gripCoeff: 0.90, trackTempC: 12, airTempC: 10, rainIntensity: 0.10, wetLineNeeded: false, tirePressureDeltaPsi: +1.8 },
  { id: 'damp-light-mist', name: 'Light Mist', gripCoeff: 0.88, trackTempC: 16, airTempC: 14, rainIntensity: 0.15, wetLineNeeded: true, tirePressureDeltaPsi: +2.0 },
  { id: 'damp-ground', name: 'Damp Ground', gripCoeff: 0.84, trackTempC: 15, airTempC: 13, rainIntensity: 0.20, wetLineNeeded: true, tirePressureDeltaPsi: +2.0 },
  { id: 'wet-drizzle', name: 'Light Drizzle', gripCoeff: 0.78, trackTempC: 15, airTempC: 13, rainIntensity: 0.35, wetLineNeeded: true, tirePressureDeltaPsi: +2.5 },
  { id: 'wet-moderate-rain', name: 'Moderate Rain', gripCoeff: 0.70, trackTempC: 14, airTempC: 12, rainIntensity: 0.55, wetLineNeeded: true, tirePressureDeltaPsi: +3.0 },
  { id: 'wet-heavy-rain', name: 'Heavy Rain', gripCoeff: 0.60, trackTempC: 13, airTempC: 11, rainIntensity: 0.80, wetLineNeeded: true, tirePressureDeltaPsi: +3.5 },
  { id: 'wet-thunderstorm', name: 'Thunderstorm', gripCoeff: 0.54, trackTempC: 12, airTempC: 10, rainIntensity: 0.95, wetLineNeeded: true, tirePressureDeltaPsi: +4.0 },
  { id: 'wet-drying-track', name: 'Drying Track', gripCoeff: 0.82, trackTempC: 18, airTempC: 15, rainIntensity: 0.05, wetLineNeeded: true, tirePressureDeltaPsi: +1.0 },
  { id: 'wet-scattered-showers', name: 'Scattered Showers', gripCoeff: 0.73, trackTempC: 16, airTempC: 14, rainIntensity: 0.45, wetLineNeeded: true, tirePressureDeltaPsi: +2.5 },
  { id: 'extreme-standing-water', name: 'Standing Water / Aquaplane', gripCoeff: 0.48, trackTempC: 11, airTempC: 9, rainIntensity: 1.0, wetLineNeeded: true, tirePressureDeltaPsi: +4.5 }
];

export class WeatherMatrixCalculator {
  /**
   * Retrieves full profile for a preset
   * @param {string} weatherId
   * @returns {Object}
   */
  static getPreset(weatherId) {
    return FORZA_18_WEATHER_PRESETS.find(w => w.id === weatherId) || FORZA_18_WEATHER_PRESETS[0];
  }

  /**
   * Calculates dynamic performance impact for a specific corner under a weather condition.
   * @param {Object} corner
   * @param {Object} weatherPreset
   * @returns {Object}
   */
  static calculateCornerImpact(corner, weatherPreset) {
    const grip = weatherPreset.gripCoeff;
    const baseSpeed = corner.speed?.apexMph || corner.refSpeed || 60;
    // Grip scales corner speed by sqrt(grip)
    const adjustedSpeedMph = Math.round(baseSpeed * Math.sqrt(grip));
    const speedLossMph = Math.round(baseSpeed - adjustedSpeedMph);

    // Braking distance scales inversely with grip
    const brakingMultiplier = Number((1 / grip).toFixed(2));
    const extraBrakingFeet = Math.round((brakingMultiplier - 1) * 80);

    return {
      weatherName: weatherPreset.name,
      gripCoeff: grip,
      adjustedApexSpeedMph: adjustedSpeedMph,
      speedLossMph,
      brakingMultiplier,
      extraBrakingFeet,
      wetLineAdvice: weatherPreset.wetLineNeeded
        ? 'Avoid the rubbered-in racing groove; drive rim of track (rim-shot) on corner entry.'
        : 'Stick to geometric late-apex dry groove.'
    };
  }

  /**
   * Returns complete 18-weather matrix for a track.
   * @param {Object} trackData
   * @returns {Array<Object>}
   */
  static generateTrackWeatherDossier(trackData) {
    return FORZA_18_WEATHER_PRESETS.map(preset => {
      return {
        ...preset,
        estimatedLapTimeDeltaSec: Number(((1 - preset.gripCoeff) * 35).toFixed(2)),
        recommendedCompound: preset.rainIntensity > 0.4 ? 'WET TIRE' : (preset.rainIntensity > 0.1 ? 'INTERMEDIATE' : 'SOFT/MEDIUM DRY'),
        brakeBiasOffset: preset.wetLineNeeded ? 'Rearward -2.0% (prevent front lockup on paint)' : 'Standard 54/46',
        coachingNotes: preset.wetLineNeeded
          ? 'Stay off smooth painted curbs. Brake in a straight line before steering.'
          : 'High grip available. Maximize friction circle loading.'
      };
    });
  }
}
