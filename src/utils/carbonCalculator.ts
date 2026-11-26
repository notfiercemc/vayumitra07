import type { CarbonFootprintInputs, CarbonFootprintResult } from '../types/airQuality.ts';

const VEHICLE_EMISSION_KG_PER_KM: Record<CarbonFootprintInputs['vehicleType'], number> = {
  petrol: 0.192,
  diesel: 0.171,
  hybrid: 0.115,
  ev: 0.053,
  none: 0,
};

const DIET_TONNES_PER_YEAR: Record<CarbonFootprintInputs['dietType'], number> = {
  meat_heavy: 3.3,
  balanced: 2.3,
  vegetarian: 1.7,
  vegan: 1.4,
};

export const DEFAULT_CARBON_INPUTS: CarbonFootprintInputs = {
  carKmPerWeek: 110,
  vehicleType: 'petrol',
  publicTransitKmPerWeek: 45,
  shortFlightsPerYear: 2,
  longFlightsPerYear: 1,
  electricityKwhPerMonth: 280,
  renewableSharePct: 25,
  dietType: 'balanced',
  recyclingRatePct: 50,
};

export function calculateCarbonFootprint(inputs: CarbonFootprintInputs): CarbonFootprintResult {
  const carAnnualTonnes =
    (Math.max(0, inputs.carKmPerWeek) * 52 * VEHICLE_EMISSION_KG_PER_KM[inputs.vehicleType]) / 1000;
  const transitAnnualTonnes = (Math.max(0, inputs.publicTransitKmPerWeek) * 52 * 0.055) / 1000;
  const transport = round2(carAnnualTonnes + transitAnnualTonnes);

  const flights = round2(
    Math.max(0, inputs.shortFlightsPerYear) * 0.25 +
      Math.max(0, inputs.longFlightsPerYear) * 1.15,
  );

  // Grid average ~0.44 kg CO2e/kWh attenuated by user's renewable energy share
  const effectiveGridFactor = 0.44 * (1 - Math.min(100, Math.max(0, inputs.renewableSharePct)) / 100);
  const homeEnergy = round2((Math.max(0, inputs.electricityKwhPerMonth) * 12 * effectiveGridFactor) / 1000);

  const diet = round2(DIET_TONNES_PER_YEAR[inputs.dietType]);

  // Base household waste 0.42 t/yr minus recycling savings
  const waste = round2(0.42 * (1 - 0.55 * (Math.min(100, Math.max(0, inputs.recyclingRatePct)) / 100)));

  const totalTonnesCo2e = round2(transport + flights + homeEnergy + diet + waste);

  // Paris 2030/2050 per-capita sustainable benchmark ~2.0 tonnes CO2e/yr; global avg ~4.8t
  const sustainabilityScore = Math.max(
    5,
    Math.min(100, Math.round(100 - Math.max(0, totalTonnesCo2e - 1.5) * 11.5)),
  );

  let gradeLabel: CarbonFootprintResult['gradeLabel'] = 'Moderate';
  if (sustainabilityScore >= 85) gradeLabel = 'Exemplary';
  else if (sustainabilityScore >= 70) gradeLabel = 'Low Impact';
  else if (sustainabilityScore >= 50) gradeLabel = 'Moderate';
  else if (sustainabilityScore >= 30) gradeLabel = 'High';
  else gradeLabel = 'Very High';

  const actions: CarbonFootprintResult['topActions'] = [];
  if (inputs.carKmPerWeek > 60 && inputs.vehicleType !== 'ev' && inputs.vehicleType !== 'none') {
    const potential = round2(carAnnualTonnes * 0.55);
    actions.push({
      title: 'Shift half of weekly car trips to public transit or EV carpooling',
      estimatedReductionTonnes: potential,
      effort: 'Moderate',
    });
  }
  if (inputs.renewableSharePct < 80 && homeEnergy > 0.6) {
    const potential = round2(homeEnergy * 0.7);
    actions.push({
      title: 'Enroll in a 100% green electricity tariff or rooftop solar plan',
      estimatedReductionTonnes: potential,
      effort: 'Easy',
    });
  }
  if (inputs.longFlightsPerYear >= 1) {
    actions.push({
      title: 'Replace 1 long-haul trip per year with rail or virtual attendance',
      estimatedReductionTonnes: 1.15,
      effort: 'Moderate',
    });
  }
  if (inputs.dietType === 'meat_heavy' || inputs.dietType === 'balanced') {
    const potential = round2(diet - DIET_TONNES_PER_YEAR.vegetarian);
    if (potential > 0.2) {
      actions.push({
        title: 'Adopt a predominantly plant-forward / vegetarian meal week',
        estimatedReductionTonnes: potential,
        effort: 'Easy',
      });
    }
  }
  if (inputs.recyclingRatePct < 80) {
    actions.push({
      title: 'Compost organics and raise household recycling above 85%',
      estimatedReductionTonnes: 0.18,
      effort: 'Easy',
    });
  }

  actions.sort((a, b) => b.estimatedReductionTonnes - a.estimatedReductionTonnes);

  return {
    totalTonnesCo2e,
    sustainabilityScore,
    gradeLabel,
    breakdown: {
      transport,
      flights,
      homeEnergy,
      diet,
      waste,
    },
    vsParisTargetDelta: round2(totalTonnesCo2e - 2.0),
    topActions: actions.slice(0, 3),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
