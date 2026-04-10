import { describe, it, expect } from 'vitest';
import {
  ScenarioSchema,
  PressureSchema,
  LineGroupSchema,
  PrimaryConceptSchema,
  TargetRoleFamilySchema,
  SituationSchema,
  FieldZoneSchema,
  GameStateSchema,
  FeedbackHintsSchema,
  OutcomePreviewSchema,
  ConsequenceFrameSchema,
} from '../scenarios/scenarioSchema';

// ── Minimal valid scenario used as a base for extension tests ────────────────

const baseScenario = {
  scenario_id: 'CM_SUPPORT_INSIDE_01',
  version: 2,
  title: 'CM offers inside support under outside pressure',
  description: 'Move the CM to support the ball carrier safely.',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'CM1',
  ball: { x: 58, y: 68 },
  teammates: [
    { id: 'CM1', role: 'CM', team: 'home', x: 50, y: 58 },
    { id: 'CB1', role: 'CB', team: 'home', x: 52, y: 66 },
  ],
  opponents: [{ id: 'F1', role: 'F', team: 'away', x: 61, y: 67 }],
  pressure: { direction: 'outside_in', intensity: 'medium' },
  ideal_regions: [{ type: 'circle', x: 52, y: 63, r: 6 }],
  acceptable_regions: [{ type: 'rectangle', x: 46, y: 58, width: 14, height: 12 }],
  weight_profile: 'attack_v1',
  constraint_thresholds: { support: 0.65, passing_lane: 0.60 },
  difficulty: 3,
  tags: ['support', 'midfield', 'attack'],
};

// ── PressureSchema extensions ────────────────────────────────────────────────

describe('PressureSchema — extended optional fields', () => {
  it('accepts minimal pressure (direction + intensity only)', () => {
    const result = PressureSchema.safeParse({ direction: 'outside_in', intensity: 'medium' });
    expect(result.success).toBe(true);
  });

  it('accepts fully extended pressure object', () => {
    const pressure = {
      direction: 'outside_in',
      intensity: 'high',
      primary_presser_id: 'F1',
      forced_side: 'sideline',
      blocked_lane: 'central_return',
      trap_zone: 'right_touchline',
    };
    expect(PressureSchema.safeParse(pressure).success).toBe(true);
  });

  it('rejects an invalid forced_side value', () => {
    const pressure = { direction: 'outside_in', intensity: 'medium', forced_side: 'diagonal' };
    expect(PressureSchema.safeParse(pressure).success).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    const pressure = { direction: 'outside_in', intensity: 'medium', unknown_field: true };
    expect(PressureSchema.safeParse(pressure).success).toBe(false);
  });
});

// ── Controlled vocabulary schemas ─────────────────────────────────────────────

describe('LineGroupSchema', () => {
  it('accepts a valid line group', () => {
    expect(LineGroupSchema.safeParse('midfield').success).toBe(true);
  });

  it('rejects an invalid value', () => {
    expect(LineGroupSchema.safeParse('striker').success).toBe(false);
  });
});

describe('PrimaryConceptSchema', () => {
  it.each(['support', 'cover'])('accepts "%s"', (v) => {
    expect(PrimaryConceptSchema.safeParse(v).success).toBe(true);
  });

  it('rejects an invalid value', () => {
    expect(PrimaryConceptSchema.safeParse('dribble').success).toBe(false);
  });
});

describe('TargetRoleFamilySchema', () => {
  it('accepts a valid target role family', () => {
    expect(TargetRoleFamilySchema.safeParse('midfield').success).toBe(true);
  });
});

describe('SituationSchema', () => {
  it.each(['build_out_under_press', 'circle_entry_support'])('accepts "%s"', (v) => {
    expect(SituationSchema.safeParse(v).success).toBe(true);
  });

  it('rejects an unknown situation', () => {
    expect(SituationSchema.safeParse('dead_ball').success).toBe(false);
  });
});

describe('FieldZoneSchema', () => {
  it.each(['defensive_third_central', 'attacking_third_right'])('accepts "%s"', (v) => {
    expect(FieldZoneSchema.safeParse(v).success).toBe(true);
  });

  it('rejects an unknown zone', () => {
    expect(FieldZoneSchema.safeParse('halfway_line').success).toBe(false);
  });
});

describe('GameStateSchema', () => {
  it.each(['open_play', 'counter'])('accepts "%s"', (v) => {
    expect(GameStateSchema.safeParse(v).success).toBe(true);
  });

  it('rejects an unknown game state', () => {
    expect(GameStateSchema.safeParse('penalty_corner').success).toBe(false);
  });
});

// ── FeedbackHintsSchema ───────────────────────────────────────────────────────

describe('FeedbackHintsSchema', () => {
  it('accepts an empty object', () => {
    expect(FeedbackHintsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a fully populated hints object', () => {
    const hints = {
      success: 'You created a playable inside support angle.',
      common_error: 'You stayed too flat or too close.',
      alternate_valid: 'This was still a workable support option.',
      teaching_emphasis: 'Support should help the ball carrier escape pressure.',
    };
    expect(FeedbackHintsSchema.safeParse(hints).success).toBe(true);
  });

  it('accepts partial hints (success only)', () => {
    expect(FeedbackHintsSchema.safeParse({ success: 'Well placed.' }).success).toBe(true);
  });

  it('rejects unknown fields (strict mode)', () => {
    expect(FeedbackHintsSchema.safeParse({ success: 'Ok', extra: true }).success).toBe(false);
  });
});

// ── ScenarioSchema — new optional fields ─────────────────────────────────────

describe('ScenarioSchema — existing scenarios remain valid', () => {
  it('accepts a scenario with only required fields (no new optional fields)', () => {
    const result = ScenarioSchema.safeParse(baseScenario);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });
});

describe('ScenarioSchema — tactical semantics fields', () => {
  it('accepts scenario with line_group, primary_concept, secondary_concepts, teaching_point', () => {
    const scenario = {
      ...baseScenario,
      line_group: 'midfield',
      primary_concept: 'support',
      secondary_concepts: ['spacing', 'pressure_response'],
      teaching_point: 'Offer an inside passing angle without becoming flat.',
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it('rejects an invalid primary_concept value', () => {
    const scenario = { ...baseScenario, primary_concept: 'slide_tackle' };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it('rejects an invalid value in secondary_concepts', () => {
    const scenario = { ...baseScenario, secondary_concepts: ['support', 'invalid_concept'] };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });
});

describe('ScenarioSchema — role and tactical context fields', () => {
  it('accepts scenario with target_role_family, situation, field_zone, game_state', () => {
    const scenario = {
      ...baseScenario,
      target_role_family: 'midfield',
      situation: 'build_out_under_press',
      field_zone: 'middle_third_right',
      game_state: 'open_play',
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it('rejects an invalid situation', () => {
    const scenario = { ...baseScenario, situation: 'dead_ball_restart' };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it('rejects an invalid field_zone', () => {
    const scenario = { ...baseScenario, field_zone: 'centre_circle' };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });
});

describe('ScenarioSchema — curriculum and progression fields', () => {
  it('accepts scenario with curriculum_group, learning_stage, prerequisites, recommended_after', () => {
    const scenario = {
      ...baseScenario,
      curriculum_group: 'midfield_support',
      learning_stage: 2,
      prerequisites: ['CM_SUPPORT_BASIC_01'],
      recommended_after: ['CM_SUPPORT_PRESSURE_02'],
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it('rejects a non-integer learning_stage', () => {
    const scenario = { ...baseScenario, learning_stage: 1.5 };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it('rejects a negative learning_stage', () => {
    const scenario = { ...baseScenario, learning_stage: -1 };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });
});

describe('ScenarioSchema — feedback_hints field', () => {
  it('accepts scenario with feedback_hints', () => {
    const scenario = {
      ...baseScenario,
      feedback_hints: {
        success: 'Great support angle.',
        common_error: 'Too flat — easier to screen out.',
        alternate_valid: 'Still playable even outside the ideal region.',
      },
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it('rejects scenario with invalid feedback_hints (unknown key)', () => {
    const scenario = { ...baseScenario, feedback_hints: { success: 'Ok', extra: true } };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });
});

describe('ScenarioSchema — scenario_archetype field', () => {
  it('accepts scenario with scenario_archetype string', () => {
    const scenario = { ...baseScenario, scenario_archetype: 'interior_support_under_press' };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });
});

describe('ScenarioSchema — pressure extended fields', () => {
  it('accepts scenario with extended pressure fields', () => {
    const scenario = {
      ...baseScenario,
      pressure: {
        direction: 'outside_in',
        intensity: 'medium',
        primary_presser_id: 'F1',
        forced_side: 'inside',
        blocked_lane: 'line_pass',
      },
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });
});

describe('ScenarioSchema — fully extended scenario example', () => {
  it('accepts the complete example scenario from the roadmap document', () => {
    const fullScenario = {
      scenario_id: 'CM_SUPPORT_INSIDE_01',
      version: 2,
      title: 'CM offers inside support under outside pressure',
      description: 'Move the CM to support the ball carrier safely and keep the shape connected.',
      phase: 'attack',
      team_orientation: 'home_attacks_positive_x',
      target_player: 'CM1',
      ball: { x: 58, y: 68 },
      teammates: [
        { id: 'GK1', role: 'GK', team: 'home', x: 10, y: 50 },
        { id: 'CB1', role: 'CB', team: 'home', x: 52, y: 66 },
        { id: 'RB1', role: 'RB', team: 'home', x: 63, y: 78 },
        { id: 'CM1', role: 'CM', team: 'home', x: 50, y: 58 },
        { id: 'LW1', role: 'LW', team: 'home', x: 74, y: 40 },
      ],
      opponents: [
        { id: 'F1', role: 'F', team: 'away', x: 61, y: 67 },
        { id: 'F2', role: 'F', team: 'away', x: 66, y: 73 },
        { id: 'CMA1', role: 'CM', team: 'away', x: 57, y: 57 },
      ],
      pressure: {
        direction: 'outside_in',
        intensity: 'medium',
        primary_presser_id: 'F1',
        forced_side: 'inside',
        blocked_lane: 'line_pass',
      },
      ideal_regions: [
        {
          type: 'polygon',
          vertices: [
            { x: 49, y: 60 },
            { x: 55, y: 58 },
            { x: 58, y: 64 },
            { x: 51, y: 66 },
          ],
        },
      ],
      acceptable_regions: [
        { type: 'rectangle', x: 46, y: 58, width: 14, height: 12 },
      ],
      weight_profile: 'attack_v1',
      constraint_thresholds: {
        support: 0.65,
        passing_lane: 0.60,
        spacing: 0.50,
        pressure_relief: 0.55,
      },
      difficulty: 3,
      tags: ['support', 'midfield', 'attack', 'pressure'],
      line_group: 'midfield',
      primary_concept: 'support',
      secondary_concepts: ['spacing', 'pressure_response'],
      teaching_point: 'Offer an inside passing angle without becoming flat or crowding the nearest support.',
      target_role_family: 'midfield',
      situation: 'build_out_under_press',
      field_zone: 'middle_third_right',
      game_state: 'open_play',
      curriculum_group: 'midfield_support',
      learning_stage: 2,
      prerequisites: ['CM_SUPPORT_BASIC_01'],
      scenario_archetype: 'interior_support_under_press',
      feedback_hints: {
        success: 'You created a playable inside support angle and helped the ball carrier escape pressure.',
        common_error: 'You stayed too flat or too close, which reduced the value of the support option.',
        alternate_valid: 'This was still a workable support option even though it sat outside the best authored zone.',
      },
    };

    const result = ScenarioSchema.safeParse(fullScenario);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });
});

// ── OutcomePreviewSchema ──────────────────────────────────────────────────────

describe('OutcomePreviewSchema', () => {
  it('accepts a minimal outcome with consequence_type + explanation', () => {
    const outcome = {
      consequence_type: 'pass_opened',
      explanation: 'Moving into the staggered pocket opens a clean diagonal pass.',
    };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(true);
  });

  it('accepts a fully enriched outcome', () => {
    const outcome = {
      consequence_type: 'triangle_formed',
      explanation: 'Your position restores a support triangle.',
      arrows: [
        { style: 'pass', from_entity_id: 'gk', to_entity_id: 'cm1', label: 'outlet' },
        { style: 'run', from_entity_id: 'cm1', to_point: { x: 35, y: 45 } },
      ],
      entity_shifts: [
        { entity_id: 'fw1', to_x: 65, to_y: 50, label: 'push up' },
      ],
      pass_option_states: [
        { from_entity_id: 'gk', to_entity_id: 'cm1', state: 'open' },
      ],
      lane_highlight: {
        label: 'outlet lane',
        state: 'open',
        geometry: { type: 'lane', x1: 10, y1: 48, x2: 30, y2: 55, width: 8 },
      },
      pressure_result: 'broken',
      shape_result: 'triangle_formed',
    };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(true);
  });

  it('rejects an outcome with an unknown consequence_type', () => {
    const outcome = { consequence_type: 'goal_scored', explanation: 'Test.' };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(false);
  });

  it('rejects an outcome with an empty explanation', () => {
    const outcome = { consequence_type: 'pass_opened', explanation: '' };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(false);
  });

  it('rejects an unknown arrow style', () => {
    const outcome = {
      consequence_type: 'pass_opened',
      explanation: 'Test.',
      arrows: [{ style: 'teleport', from_entity_id: 'gk', to_entity_id: 'cm1' }],
    };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(false);
  });

  it('rejects an entity_shift with to_x out of range', () => {
    const outcome = {
      consequence_type: 'pass_opened',
      explanation: 'Test.',
      entity_shifts: [{ entity_id: 'cm1', to_x: 110, to_y: 50 }],
    };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    const outcome = { consequence_type: 'pass_opened', explanation: 'Test.', extra: true };
    expect(OutcomePreviewSchema.safeParse(outcome).success).toBe(false);
  });
});

// ── ConsequenceFrameSchema ────────────────────────────────────────────────────

describe('ConsequenceFrameSchema', () => {
  it('accepts an empty consequence frame (both branches optional)', () => {
    expect(ConsequenceFrameSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a frame with only on_success', () => {
    const frame = {
      on_success: { consequence_type: 'pass_opened', explanation: 'Outlet opens.' },
    };
    expect(ConsequenceFrameSchema.safeParse(frame).success).toBe(true);
  });

  it('accepts a frame with only on_failure', () => {
    const frame = {
      on_failure: { consequence_type: 'pressure_maintained', explanation: 'Press held.' },
    };
    expect(ConsequenceFrameSchema.safeParse(frame).success).toBe(true);
  });

  it('accepts a frame with both branches', () => {
    const frame = {
      on_success: { consequence_type: 'pass_opened', explanation: 'Outlet opens.' },
      on_failure: { consequence_type: 'pass_blocked', explanation: 'Lane blocked.' },
    };
    expect(ConsequenceFrameSchema.safeParse(frame).success).toBe(true);
  });

  it('rejects unknown fields (strict mode)', () => {
    const frame = { on_success: null, extra: true };
    expect(ConsequenceFrameSchema.safeParse(frame).success).toBe(false);
  });
});

// ── ScenarioSchema — consequence_frame field ──────────────────────────────────

describe('ScenarioSchema — consequence_frame field', () => {
  it('accepts a scenario with a minimal consequence_frame', () => {
    const scenario = {
      ...baseScenario,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Moving into the pocket opens the outlet pass.',
        },
      },
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it('accepts a scenario without consequence_frame (field remains optional)', () => {
    expect(ScenarioSchema.safeParse(baseScenario).success).toBe(true);
  });

  it('rejects a consequence_frame with invalid consequence_type', () => {
    const scenario = {
      ...baseScenario,
      consequence_frame: {
        on_success: { consequence_type: 'unknown_type', explanation: 'Test.' },
      },
    };
    expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
  });
});
