import json, re
cases = ['conversation.greeting','conversation.context-continuation','conversation.clarification','tool.single-strict-json','tool.argument-extraction-strict-json','tool.multiple-strict-json','tool.hallucination-guard','boundary.no-evidence-no-outcome','plan.compound-goal','plan.replan-after-unavailable','plan.multilingual','plan.diagnostic']
merged = {
  'generatedAt': '2026-09-14',
  'note': 'Merged summary of two harness runs (same 12-case subset mirroring qualify-local-models.ts rubric, temperature 0, Ollama /api/chat native templates). Run A: gemma3:4b, llama3.2:3b + baselines. Run B: qwen3:4b + baselines. The qwen3:4b score is a RUNTIME ARTIFACT: the local Ollama build did not honor the think:false flag, thinking text leaked into content and exhausted token budgets; it is not a model capability score.',
  'runs': {'A': 'gemma3:4b, llama3.2:3b, qwen2.5-0.5b, smollm2:360m', 'B': 'qwen3:4b, qwen2.5-0.5b, smollm2:360m'},
  'scores': {
    'gemma3:4b': '10/12 (11/12 substantive: the boundary-probe fail is a rubric false positive on negated wording)',
    'llama3.2:3b': '6/12 (strong conversation; weak strict-JSON adherence)',
    'qwen3:4b': '4/12 (runtime artifact, see note)',
    'qwen2.5-0.5b': '3/12 (run B)',
    'smollm2:360m': '5/12 (run B)'
  },
  'results': []
}
for tag, path in [('A','/tmp/cand-bench.log'), ('B','/tmp/qwen3-bench.log')]:
    for line in open(path):
        line = line.strip()
        m = re.match(r'^(\S+) (\S+): (PASS|FAIL) tok=(\d+)(?: \((.*)\))?', line)
        if m and m.group(2) in cases:
            merged['results'].append({'run': tag, 'model': m.group(1), 'caseId': m.group(2), 'passed': m.group(3) == 'PASS', 'tokens': int(m.group(4)), 'notes': m.group(5) or ''})
json.dump(merged, open('docs/verification/local-model-candidate-benchmark-summary.json','w'), indent=2)
print('results', len(merged['results']))
