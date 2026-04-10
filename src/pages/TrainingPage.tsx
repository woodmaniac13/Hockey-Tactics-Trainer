import { useState, useEffect, useMemo } from 'react';
import type { Scenario, Point, WeightProfile, FeedbackResult, ProgressRecord, ScenarioPack, ScenarioState, ReasoningOption, LineGroup, PrimaryConceptVocab, SituationVocab } from '../types';
import Board from '../board/Board';
import FeedbackPanel from '../components/FeedbackPanel';
import ScenarioSelector from '../components/ScenarioSelector';
import ReasoningCapture from '../components/ReasoningCapture';
import ProgressView from '../components/ProgressView';
import { evaluate } from '../evaluation/evaluator';
import { generateFeedback } from '../feedback/feedbackGenerator';
import { getScenarioState, getUnmetPrerequisites } from '../progression/progression';
import { getProgress, updateProgress, addAttempt, getSettings } from '../storage/storage';
import useIsMobile from '../hooks/useIsMobile';

interface TrainingPageProps {
  scenarioMap: Record<string, Scenario>;
  weightProfiles: Record<string, WeightProfile>;
  packs: ScenarioPack[];
  onLoadPack: (packId: string) => Promise<void>;
}

function getDefaultPosition(scenario: Scenario): Point {
  const target = scenario.teammates.find(t => t.id === scenario.target_player);
  if (target) return { x: target.x, y: target.y };
  return { x: 50, y: 50 };
}

/** Mobile screen state: list view or play view */
type MobileScreen = 'list' | 'play';

export default function TrainingPage({ scenarioMap, weightProfiles, packs, onLoadPack }: TrainingPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playerPosition, setPlayerPosition] = useState<Point>({ x: 50, y: 50 });
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressRecord>>(getProgress());
  const [showReasoning, setShowReasoning] = useState(false);
  const [activeTab, setActiveTab] = useState<'training' | 'progress'>('training');
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>('list');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [filterLineGroup, setFilterLineGroup] = useState<LineGroup | undefined>();
  const [filterPrimaryConcept, setFilterPrimaryConcept] = useState<PrimaryConceptVocab | undefined>();
  const [filterSituation, setFilterSituation] = useState<SituationVocab | undefined>();
  const settings = getSettings();
  const isMobile = useIsMobile();

  const scenario = selectedId ? scenarioMap[selectedId] : null;
  const scenarios = useMemo(() => Object.values(scenarioMap), [scenarioMap]);

  useEffect(() => {
    if (scenario) {
      setPlayerPosition(getDefaultPosition(scenario));
      setSubmitted(false);
      setFeedback(null);
      setShowReasoning(false);
      setDetailsExpanded(false);
    }
  }, [selectedId]);

  const scenarioStates: Record<string, ScenarioState> = {};
  for (const s of scenarios) {
    scenarioStates[s.scenario_id] = getScenarioState(s.scenario_id, s.difficulty, progress, scenarios);
  }

  const handleSelectScenario = (id: string) => {
    setSelectedId(id);
    setActiveTab('training');
    if (isMobile) setMobileScreen('play');
  };

  const handleBack = () => {
    setMobileScreen('list');
  };

  const handleSubmit = () => {
    if (!scenario || submitted) return;
    if (settings.enable_reasoning_prompt) {
      setShowReasoning(true);
    } else {
      doEvaluate(scenario, undefined);
    }
  };

  const doEvaluate = (sc: Scenario, reasoning: ReasoningOption | undefined) => {
    const profile = weightProfiles[sc.weight_profile];
    if (!profile) {
      console.error(`Scenario "${sc.scenario_id}" references missing weight profile "${sc.weight_profile}". Evaluation blocked.`);
      alert(`This scenario cannot be evaluated because its weight profile "${sc.weight_profile}" is missing.`);
      setShowReasoning(false);
      return;
    }
    const result = evaluate(sc, playerPosition, profile, reasoning);
    const fb = generateFeedback(result, sc, reasoning);
    setFeedback(fb);
    setSubmitted(true);
    setShowReasoning(false);

    const existing = progress[sc.scenario_id];
    const newRecord: ProgressRecord = {
      version: 1,
      best_score: Math.max(result.score, existing?.best_score ?? 0),
      last_score: result.score,
      attempt_count: (existing?.attempt_count ?? 0) + 1,
      last_played: Date.now(),
    };
    updateProgress(sc.scenario_id, newRecord);
    addAttempt(sc.scenario_id, {
      version: 1,
      score: result.score,
      result_type: result.result_type,
      position: playerPosition,
      reasoning,
      timestamp: Date.now(),
    });
    setProgress(getProgress());
  };

  const handleReset = () => {
    if (!scenario) return;
    setPlayerPosition(getDefaultPosition(scenario));
    setSubmitted(false);
    setFeedback(null);
    setShowReasoning(false);
  };

  const handleNext = () => {
    const idx = scenarios.findIndex(s => s.scenario_id === selectedId);
    const next = scenarios[idx + 1] ?? scenarios[0];
    if (next) setSelectedId(next.scenario_id);
  };

  /** Format tag names for display: build_out → "Build-out" */
  const formatTag = (tag: string): string =>
    tag.replace(/_/g, '-').replace(/^\w/, c => c.toUpperCase());

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e' }}>
        {/* Mobile Header */}
        <header style={{ padding: '10px 16px', background: '#0f3460', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {mobileScreen === 'play' && scenario ? (
            <button
              onClick={handleBack}
              aria-label="Back to scenario list"
              style={{ background: 'none', border: 'none', color: '#e0e0e0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}
            >
              ← Back
            </button>
          ) : (
            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e0e0e0' }}>⚽ Tactical Trainer</div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => { setActiveTab('training'); setMobileScreen('list'); }}
              style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', background: activeTab === 'training' ? '#3498db' : '#2c3e50', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Training
            </button>
            <button
              onClick={() => { setActiveTab('progress'); setMobileScreen('list'); }}
              style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', background: activeTab === 'progress' ? '#3498db' : '#2c3e50', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Progress
            </button>
          </div>
        </header>

        {/* Mobile Body */}
        {activeTab === 'progress' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <ProgressView
              scenarios={scenarios}
              progress={progress}
              onSelectScenario={id => { handleSelectScenario(id); }}
              onProgressChange={() => setProgress(getProgress())}
            />
          </div>
        ) : mobileScreen === 'list' ? (
          /* ── Screen A: Scenario List ── */
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <ScenarioSelector
              packs={packs}
              scenarios={scenarioMap}
              progress={progress}
              scenarioStates={scenarioStates}
              selectedId={selectedId}
              onSelect={handleSelectScenario}
              onPackExpand={onLoadPack}
              isMobile
              filterLineGroup={filterLineGroup}
              filterPrimaryConcept={filterPrimaryConcept}
              filterSituation={filterSituation}
              onFilterLineGroupChange={setFilterLineGroup}
              onFilterPrimaryConceptChange={setFilterPrimaryConcept}
              onFilterSituationChange={setFilterSituation}
            />
          </div>
        ) : scenario ? (
          /* ── Screen B: Scenario Play + Result ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Title + short prompt */}
            <div style={{ padding: '10px 16px', background: '#16213e', flexShrink: 0 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e0e0e0' }}>{scenario.title}</div>
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '2px' }}>
                {scenario.description}
              </div>
            </div>

            {/* Expandable scenario details (mobile) */}
            <button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              style={{
                padding: '6px 16px',
                background: '#16213e',
                border: 'none',
                borderTop: '1px solid #2c3e50',
                color: '#888',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                flexShrink: 0,
              }}
            >
              {detailsExpanded ? '▾ Hide details' : '▸ Scenario details'}
            </button>
            {detailsExpanded && (
              <div style={{ padding: '8px 16px', background: '#16213e', borderTop: '1px solid #2c3e50', fontSize: '0.8rem', color: '#aaa', flexShrink: 0 }}>
                {/* Phase / tag badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: '#2c3e50', color: '#aaa' }}>
                    {formatTag(scenario.phase)}
                  </span>
                  {scenario.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: '#2c3e50', color: '#aaa' }}>
                      {formatTag(tag)}
                    </span>
                  ))}
                </div>
                {/* Semantic metadata badges */}
                {(scenario.line_group || scenario.primary_concept || scenario.situation || scenario.scenario_archetype) && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {scenario.line_group && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', border: '1px solid rgba(52,152,219,0.4)' }}>
                        {formatTag(scenario.line_group)} line
                      </span>
                    )}
                    {scenario.primary_concept && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(39, 174, 96, 0.2)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.4)' }}>
                        {formatTag(scenario.primary_concept)}
                      </span>
                    )}
                    {scenario.situation && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(142, 68, 173, 0.2)', color: '#a97dc4', border: '1px solid rgba(142,68,173,0.4)' }}>
                        {formatTag(scenario.situation)}
                      </span>
                    )}
                    {scenario.scenario_archetype && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(230, 126, 34, 0.2)', color: '#e67e22', border: '1px solid rgba(230,126,34,0.4)' }}>
                        {formatTag(scenario.scenario_archetype)}
                      </span>
                    )}
                  </div>
                )}
                {/* Curriculum context */}
                {(scenario.curriculum_group || scenario.learning_stage !== undefined) && (
                  <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#888' }}>
                    {scenario.curriculum_group && <span>{formatTag(scenario.curriculum_group)}</span>}
                    {scenario.learning_stage !== undefined && (
                      <span> · Stage {scenario.learning_stage}</span>
                    )}
                  </div>
                )}
                {/* Teaching point */}
                {scenario.teaching_point && (
                  <div style={{ marginTop: '6px', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', color: '#ccc', fontSize: '0.75rem', borderLeft: '2px solid #3498db' }}>
                    {scenario.teaching_point}
                  </div>
                )}
                {/* Unmet prerequisites warning */}
                {(() => {
                  const unmet = getUnmetPrerequisites(scenario, progress);
                  return unmet.length > 0 ? (
                    <div style={{ marginTop: '6px', padding: '4px 8px', background: 'rgba(231,76,60,0.1)', borderLeft: '2px solid #e74c3c', borderRadius: '4px', color: '#e74c3c', fontSize: '0.7rem' }}>
                      ⚠ Complete first: {unmet.join(', ')}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Field (dominant on mobile) */}
            <div style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Board
                scenario={scenario}
                playerPosition={playerPosition}
                onPositionChange={pos => { if (!submitted) setPlayerPosition(pos); }}
                submitted={submitted}
                showOverlays={settings.show_overlays}
              />
            </div>

            {/* Reasoning capture inline */}
            {showReasoning && (
              <div style={{ padding: '8px 12px', flexShrink: 0 }}>
                <ReasoningCapture onSubmit={reasoning => doEvaluate(scenario, reasoning)} />
              </div>
            )}

            {/* Result feedback (mobile-optimized) */}
            {feedback && (
              <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: '40vh', flexShrink: 0 }}>
                <FeedbackPanel feedback={feedback} onRetry={handleReset} onNext={handleNext} isMobile />
              </div>
            )}

            {/* Sticky bottom action bar */}
            {!submitted && !showReasoning && (
              <div style={{
                padding: '10px 16px',
                paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
                background: '#0f3460',
                display: 'flex',
                gap: '10px',
                flexShrink: 0,
                borderTop: '1px solid #2c3e50',
              }}>
                <button
                  onClick={handleReset}
                  style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: '#2c3e50', color: '#ccc', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                >
                  Reset
                </button>
                <button
                  onClick={handleSubmit}
                  style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', background: '#27ae60', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                >
                  Submit Position
                </button>
              </div>
            )}

            {/* Sticky bottom bar: Retry / Next (result state) */}
            {feedback && !showReasoning && (
              <div style={{
                padding: '10px 16px',
                paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
                background: '#0f3460',
                display: 'flex',
                gap: '10px',
                flexShrink: 0,
                borderTop: '1px solid #2c3e50',
              }}>
                <button
                  onClick={handleReset}
                  style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: '#2c3e50', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ↺ Retry
                </button>
                <button
                  onClick={handleNext}
                  style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: '#3498db', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#aaa', textAlign: 'center', marginTop: '40px', padding: '20px' }}>
            Select a scenario to begin training.
          </div>
        )}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e' }}>
      {/* Header */}
      <header style={{ padding: '12px 20px', background: '#0f3460', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#e0e0e0' }}>⚽ Field Hockey Tactical Trainer</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('training')}
            style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', background: activeTab === 'training' ? '#3498db' : '#2c3e50', color: '#fff', cursor: 'pointer' }}
          >
            Training
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', background: activeTab === 'progress' ? '#3498db' : '#2c3e50', color: '#fff', cursor: 'pointer' }}
          >
            Progress
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: '280px', minWidth: '220px', padding: '16px', background: '#16213e', overflowY: 'auto', borderRight: '1px solid #2c3e50' }}>
          {activeTab === 'training' ? (
            <ScenarioSelector
              packs={packs}
              scenarios={scenarioMap}
              progress={progress}
              scenarioStates={scenarioStates}
              selectedId={selectedId}
              onSelect={handleSelectScenario}
              onPackExpand={onLoadPack}
              filterLineGroup={filterLineGroup}
              filterPrimaryConcept={filterPrimaryConcept}
              filterSituation={filterSituation}
              onFilterLineGroupChange={setFilterLineGroup}
              onFilterPrimaryConceptChange={setFilterPrimaryConcept}
              onFilterSituationChange={setFilterSituation}
            />
          ) : (
            <ProgressView
              scenarios={scenarios}
              progress={progress}
              onSelectScenario={id => { handleSelectScenario(id); }}
              onProgressChange={() => setProgress(getProgress())}
            />
          )}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scenario ? (
            <>
              <div style={{ background: '#16213e', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#e0e0e0' }}>{scenario.title}</div>
                <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '4px' }}>{scenario.description}</div>
                {/* Phase / tag badges */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: '#2c3e50', color: '#aaa' }}>
                    {formatTag(scenario.phase)}
                  </span>
                  {scenario.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: '#2c3e50', color: '#aaa' }}>
                      {formatTag(tag)}
                    </span>
                  ))}
                </div>
                {/* Semantic metadata badges */}
                {(scenario.line_group || scenario.primary_concept || scenario.situation || scenario.scenario_archetype) && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {scenario.line_group && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', border: '1px solid rgba(52,152,219,0.4)' }}>
                        {formatTag(scenario.line_group)} line
                      </span>
                    )}
                    {scenario.primary_concept && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(39, 174, 96, 0.2)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.4)' }}>
                        {formatTag(scenario.primary_concept)}
                      </span>
                    )}
                    {scenario.situation && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(142, 68, 173, 0.2)', color: '#a97dc4', border: '1px solid rgba(142,68,173,0.4)' }}>
                        {formatTag(scenario.situation)}
                      </span>
                    )}
                    {scenario.scenario_archetype && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(230, 126, 34, 0.2)', color: '#e67e22', border: '1px solid rgba(230,126,34,0.4)' }}>
                        {formatTag(scenario.scenario_archetype)}
                      </span>
                    )}
                  </div>
                )}
                {/* Curriculum context */}
                {(scenario.curriculum_group || scenario.learning_stage !== undefined) && (
                  <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#888' }}>
                    {scenario.curriculum_group && <span>{formatTag(scenario.curriculum_group)}</span>}
                    {scenario.learning_stage !== undefined && (
                      <span> · Stage {scenario.learning_stage}</span>
                    )}
                  </div>
                )}
                {/* Teaching point */}
                {scenario.teaching_point && (
                  <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', color: '#ccc', fontSize: '0.8rem', borderLeft: '2px solid #3498db' }}>
                    {scenario.teaching_point}
                  </div>
                )}
                {/* Unmet prerequisites warning */}
                {(() => {
                  const unmet = getUnmetPrerequisites(scenario, progress);
                  return unmet.length > 0 ? (
                    <div style={{ marginTop: '8px', padding: '5px 10px', background: 'rgba(231,76,60,0.1)', borderLeft: '2px solid #e74c3c', borderRadius: '4px', color: '#e74c3c', fontSize: '0.8rem' }}>
                      ⚠ Complete prerequisites first: {unmet.join(', ')}
                    </div>
                  ) : null;
                })()}
              </div>

              <Board
                scenario={scenario}
                playerPosition={playerPosition}
                onPositionChange={pos => { if (!submitted) setPlayerPosition(pos); }}
                submitted={submitted}
                showOverlays={settings.show_overlays}
              />

              {!submitted && !showReasoning && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleReset}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#2c3e50', color: '#ccc', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSubmit}
                    style={{ flex: 2, padding: '10px', borderRadius: '6px', border: 'none', background: '#27ae60', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Submit Position
                  </button>
                </div>
              )}

              {showReasoning && (
                <ReasoningCapture onSubmit={reasoning => doEvaluate(scenario, reasoning)} />
              )}

              {feedback && (
                <FeedbackPanel feedback={feedback} onRetry={handleReset} onNext={handleNext} />
              )}
            </>
          ) : (
            <div style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
              Select a scenario to begin training.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
