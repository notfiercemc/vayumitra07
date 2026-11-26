import type { AirQualitySnapshot, VulnerableGroupAdvice } from '../types/airQuality.ts';

export function buildVulnerableGroupAdvisories(
  snapshot: AirQualitySnapshot,
): {
  groups: VulnerableGroupAdvice[];
  maskGuidance: string;
  indoorProtocol: string;
  exerciseWindow: string;
} {
  const aqi = snapshot.aqi;
  const wind = snapshot.weather.windSpeedKmh;
  const humidity = snapshot.weather.humidityPct;
  const dominant = snapshot.dominantPollutant.toUpperCase();

  let riskTier: VulnerableGroupAdvice['riskLevel'] = 'Low';
  if (aqi > 200) riskTier = 'Severe';
  else if (aqi > 150) riskTier = 'High';
  else if (aqi > 100) riskTier = 'Elevated';
  else if (aqi > 50) riskTier = 'Moderate';

  const groups: VulnerableGroupAdvice[] = [
    {
      id: 'children',
      groupName: 'Children & Infants',
      riskLevel: aqi > 100 ? (aqi > 150 ? 'Severe' : 'High') : riskTier,
      guidance:
        aqi <= 50
          ? 'Safe for normal outdoor school recess, playgrounds, and active play.'
          : aqi <= 100
            ? 'Normal outdoor play allowed; monitor sensitive children for coughing during intense sports.'
            : aqi <= 150
              ? 'Move vigorous playground and sports drills indoors; keep outdoor breaks under 20 minutes.'
              : 'Suspend all outdoor school sports and keep infants indoors with filtered air.',
      actionItem:
        aqi > 100
          ? 'Shift physical education to ventilated indoor gyms with HEPA purifiers.'
          : 'Schedule outdoor play during mid-afternoon dispersion windows.',
    },
    {
      id: 'seniors',
      groupName: 'Older Adults (65+)',
      riskLevel: aqi > 100 ? (aqi > 150 ? 'Severe' : 'High') : riskTier,
      guidance:
        aqi <= 50
          ? 'Favorable conditions for morning walks and outdoor community errands.'
          : aqi <= 100
            ? 'Light outdoor walks are acceptable; avoid high-traffic intersections during rush hour.'
            : 'Limit outdoor exposure; fine particulates heighten inflammatory and blood-pressure stress.',
      actionItem:
        aqi > 100
          ? 'Use fitted N95/FFP2 protection if stepping outside for essential errands.'
          : 'Choose tree-lined parks away from arterial roadways.',
    },
    {
      id: 'respiratory',
      groupName: 'Asthma & COPD',
      riskLevel: aqi > 80 ? (aqi > 150 ? 'Severe' : 'High') : riskTier,
      guidance:
        aqi <= 50
          ? `Low ${dominant} burden today; follow routine controller medication schedule.`
          : aqi <= 100
            ? `Elevated ${dominant} may trigger mild airway reactivity. Carry rescue bronchodilator.`
            : 'High risk of bronchospasm and wheezing. Remain indoors in a filtered room.',
      actionItem:
        aqi > 100
          ? 'Run HEPA H13 air purifier on medium-high and avoid aerosol sprays or incense.'
          : 'Keep rescue inhaler accessible during outdoor commutes.',
    },
    {
      id: 'cardiac',
      groupName: 'Heart & Vascular Health',
      riskLevel: aqi > 100 ? (aqi > 150 ? 'Severe' : 'High') : riskTier,
      guidance:
        aqi <= 50
          ? 'Minimal particulate cardiovascular load; normal aerobic activity is safe.'
          : aqi <= 100
            ? 'Avoid strenuous outdoor exertion alongside dense vehicular corridors.'
            : 'Ultrafine particles enter circulation quickly; avoid exertion and monitor chest discomfort.',
      actionItem:
        aqi > 120
          ? 'Replace outdoor cardio with low-strain indoor mobility until AQI drops below 100.'
          : 'Stay hydrated and monitor resting heart rate after outdoor walks.',
    },
    {
      id: 'pregnant',
      groupName: 'Pregnant Individuals',
      riskLevel: aqi > 100 ? (aqi > 150 ? 'Severe' : 'High') : riskTier,
      guidance:
        aqi <= 50
          ? 'Clean ambient conditions support regular prenatal walks.'
          : aqi <= 100
            ? 'Prefer indoor or low-traffic green routes; minimize exposure to diesel exhaust.'
            : 'Minimize ambient particulate exposure to protect maternal-fetal oxygen transport.',
      actionItem:
        aqi > 100
          ? 'Close roadside-facing windows and run recirculation mode when driving.'
          : 'Ventilate living spaces when wind speed exceeds 12 km/h.',
    },
    {
      id: 'athletes',
      groupName: 'Outdoor Athletes & Commuters',
      riskLevel: riskTier,
      guidance:
        aqi <= 50
          ? 'Optimal conditions for endurance running, cycling, and outdoor training.'
          : aqi <= 100
            ? 'Reduce sustained high-minute-ventilation intervals near roadways.'
            : 'High minute ventilation multiplies inhaled particulate dose 5–8×; move training indoors.',
      actionItem:
        aqi > 100
          ? 'Switch to indoor ergometer/treadmill sessions or wear a valved N95 respirator for cycling.'
          : `Current wind (${Math.round(wind)} km/h) and humidity (${humidity}%) favor afternoon sessions.`,
    },
  ];

  const maskGuidance =
    aqi <= 50
      ? 'No respiratory mask required for ambient air quality.'
      : aqi <= 100
        ? 'Optional KN95/N95 for asthma-prone commuters on congested corridors.'
        : aqi <= 150
          ? 'Certified N95 / FFP2 / KN95 recommended for sensitive groups outdoors.'
          : 'Fitted N95 or N99 respirator strongly advised for all outdoor transit.';

  const indoorProtocol =
    aqi <= 50
      ? 'Cross-ventilate rooms naturally; standard HVAC filtration is sufficient.'
      : aqi <= 120
        ? 'Keep roadside windows closed during rush hours; run purifier in bedrooms.'
        : 'Seal window gaps, switch AC to recirculate, and run HEPA filtration continuously.';

  const exerciseWindow =
    aqi <= 50
      ? 'All daylight hours suitable for outdoor exercise.'
      : aqi <= 120
        ? 'Prefer 13:00–16:30 when solar mixing lifts the boundary layer.'
        : 'Avoid outdoor workouts; conduct training in filtered indoor spaces.';

  return { groups, maskGuidance, indoorProtocol, exerciseWindow };
}
