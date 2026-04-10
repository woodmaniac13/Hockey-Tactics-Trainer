# Pass A — User Prompt Template

Generate a field hockey tactical training scenario with the following specification.

## Generation brief

- **Scenario archetype**: `{{scenario_archetype}}`
- **Phase**: `{{phase}}`
- **Difficulty**: `{{difficulty}}` (scale 1–5)
- **Field zone**: `{{field_zone}}`
- **Line group**: `{{line_group}}`
- **Target role family**: `{{target_role_family}}`
- **Primary concept**: `{{primary_concept}}`
- **Secondary concepts**: `{{secondary_concepts_json_array}}`
- **Learning stage**: `{{learning_stage}}`
- **Curriculum group**: `{{curriculum_group}}`
- **Title seed**: `{{title_seed}}`

## What to generate

Produce a single valid JSON object matching the ScenarioSchema.

The scenario must:
1. Teach one clear tactical lesson aligned to the `{{primary_concept}}` concept.
2. Place the ball inside the `{{field_zone}}` zone (x-bounds defined in the system prompt).
3. Use entity roles and positions appropriate for the `{{line_group}}` and `{{target_role_family}}`.
4. Be consistent with the `{{scenario_archetype}}` archetype constraints.
5. Have `difficulty` set to `{{difficulty}}`.
6. Include realistic pressure from `{{phase}}` context.
7. Use semantic wrapper regions (label + purpose + geometry or named_zone).
8. NOT include a `consequence_frame` field.

Respond with the JSON object only — no explanation, no markdown.
