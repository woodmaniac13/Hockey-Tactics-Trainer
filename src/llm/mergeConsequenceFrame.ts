/**
 * Consequence frame merge helper — merges an accepted Pass B consequence_frame
 * into an accepted Pass A scenario to produce the final complete scenario.
 *
 * This helper is intentionally simple: it performs a shallow merge of the
 * consequence_frame into the scenario object. The caller is responsible for
 * running validation on both inputs before calling this function.
 */

import type { Scenario, ConsequenceFrame } from '../types';

/**
 * Merges an accepted `consequence_frame` into an accepted scenario.
 *
 * Returns a new scenario object with the consequence_frame set.
 * Does not mutate the input scenario.
 *
 * @param scenario         - The accepted Pass A scenario (without consequence_frame).
 * @param consequenceFrame - The accepted Pass B consequence frame.
 * @returns A new Scenario object with consequence_frame set.
 */
export function mergeConsequenceFrame(
  scenario: Scenario,
  consequenceFrame: ConsequenceFrame,
): Scenario {
  return {
    ...scenario,
    consequence_frame: consequenceFrame,
  };
}

/**
 * Strips the consequence_frame from a scenario.
 *
 * Useful when preparing the Pass B input prompt to ensure the model generates
 * the consequence frame from scratch rather than echoing an existing one.
 *
 * @param scenario - The scenario to strip the consequence_frame from.
 * @returns A new Scenario object without consequence_frame.
 */
export function stripConsequenceFrame(scenario: Scenario): Omit<Scenario, 'consequence_frame'> {
  const { consequence_frame: _, ...rest } = scenario;
  return rest;
}
