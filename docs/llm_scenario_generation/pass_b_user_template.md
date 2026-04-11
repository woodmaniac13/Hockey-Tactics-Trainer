# Pass B — User Prompt Template

Generate the `consequence_frame` for the following accepted field hockey scenario.

## Accepted scenario

```json
{{scenario_json}}
```

## Instructions

1. Read the scenario carefully — identify the target player, the tactical lesson, and the pressure context.
2. Generate an `on_success` branch showing what happens tactically when the player positions correctly.
3. Generate an `on_failure` branch showing what happens when the player positions incorrectly.
4. Use only entity IDs from the scenario above.
5. Keep each branch simple, bounded, and board-legible.

Respond with only the JSON object `{ "on_success": ..., "on_failure": ... }` — no explanation.
