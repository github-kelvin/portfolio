import { describe, it, expect } from 'vitest';
import { anchor } from './FlowDiagram';

const box = (x, y) => ({ x, y, w: 100, h: 50 });

describe('anchor', () => {
  it('connects from the right edge when the target is to the right', () => {
    expect(anchor(box(0, 0), box(200, 0))).toEqual([100, 25]);
  });
  it('connects from the left edge when the target is to the left', () => {
    expect(anchor(box(200, 0), box(0, 0))).toEqual([200, 25]);
  });
  it('connects from the bottom edge when the target is below', () => {
    expect(anchor(box(0, 0), box(0, 200))).toEqual([50, 50]);
  });
  it('connects from the top edge when the target is above', () => {
    expect(anchor(box(0, 200), box(0, 0))).toEqual([50, 200]);
  });
});
