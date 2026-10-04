import { describe, it, expect } from 'vitest';
import { computeLevel, LEVEL_THRESHOLDS } from '../../utils/reputation.js';

describe('computeLevel (ambang level di satu tempat)', () => {
  it.each([
    [0, 'TALENTA_MUDA', 20],
    [19, 'TALENTA_MUDA', 20],
    [20, 'TALENTA_TERPERCAYA', 50],
    [49, 'TALENTA_TERPERCAYA', 50],
    [50, 'TALENTA_AHLI', 50],
    [75, 'TALENTA_AHLI', 75],
  ])('%i poin → %s (target %i)', (points, level, target) => {
    expect(computeLevel(points)).toEqual({ level, next_level_target: target });
  });

  it('ambang sesuai PRD: <20 Muda, <50 Terpercaya, ≥50 Ahli', () => {
    expect(LEVEL_THRESHOLDS).toEqual({ TALENTA_TERPERCAYA: 20, TALENTA_AHLI: 50 });
  });
});
