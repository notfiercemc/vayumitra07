import { describe, expect, it } from 'vitest';
import { calculateCarbonFootprint, DEFAULT_CARBON_INPUTS } from '../src/utils/carbonCalculator.ts';

describe('Carbon Footprint Calculator', () => {
  it('computes lower emissions for EV + plant-based + high renewables vs petrol baseline', () => {
    const baseline = calculateCarbonFootprint(DEFAULT_CARBON_INPUTS);
    const lowCarbon = calculateCarbonFootprint({
      ...DEFAULT_CARBON_INPUTS,
      vehicleType: 'ev',
      renewableSharePct: 95,
      dietType: 'vegan',
      shortFlightsPerYear: 0,
      longFlightsPerYear: 0,
    });

    expect(lowCarbon.totalTonnesCo2e).toBeLessThan(baseline.totalTonnesCo2e);
    expect(lowCarbon.sustainabilityScore).toBeGreaterThan(baseline.sustainabilityScore);
  });

  it('caps sustainability score between 5 and 100', () => {
    const extremeHigh = calculateCarbonFootprint({
      carKmPerWeek: 1000,
      vehicleType: 'petrol',
      publicTransitKmPerWeek: 0,
      shortFlightsPerYear: 20,
      longFlightsPerYear: 12,
      electricityKwhPerMonth: 1500,
      renewableSharePct: 0,
      dietType: 'meat_heavy',
      recyclingRatePct: 0,
    });
    expect(extremeHigh.sustainabilityScore).toBeGreaterThanOrEqual(5);
    expect(extremeHigh.sustainabilityScore).toBeLessThanOrEqual(100);
  });
});
