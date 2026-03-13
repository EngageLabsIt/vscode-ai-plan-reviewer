import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../extension/services/DiffEngine';

const engine = new DiffEngine();

describe('DiffEngine', () => {
  it('identical text produces only unchanged lines', () => {
    const text = 'line one\nline two\nline three\n';
    const result = engine.compute(text, text);

    expect(result.every((dl) => dl.type === 'unchanged')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('assigns correct 1-based line numbers for unchanged lines', () => {
    const text = 'a\nb\nc\n';
    const result = engine.compute(text, text);

    expect(result[0]).toMatchObject({ lineNumberOld: 1, lineNumberNew: 1 });
    expect(result[1]).toMatchObject({ lineNumberOld: 2, lineNumberNew: 2 });
    expect(result[2]).toMatchObject({ lineNumberOld: 3, lineNumberNew: 3 });
  });

  it('added lines have lineNumberOld=null and correct lineNumberNew', () => {
    const oldText = 'a\nb\n';
    const newText = 'a\nb\nc\n';
    const result = engine.compute(oldText, newText);

    const added = result.filter((dl) => dl.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].lineNumberOld).toBeNull();
    expect(added[0].lineNumberNew).toBe(3);
    expect(added[0].content).toBe('c');
  });

  it('removed lines have lineNumberNew=null and correct lineNumberOld', () => {
    const oldText = 'a\nb\nc\n';
    const newText = 'a\nb\n';
    const result = engine.compute(oldText, newText);

    const removed = result.filter((dl) => dl.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].lineNumberNew).toBeNull();
    expect(removed[0].lineNumberOld).toBe(3);
    expect(removed[0].content).toBe('c');
  });

  it('insertion in the middle shifts subsequent line numbers', () => {
    const oldText = 'a\nb\nc\n';
    const newText = 'a\nINSERTED\nb\nc\n';
    const result = engine.compute(oldText, newText);

    // 'a' unchanged at old=1, new=1
    const aLine = result.find((dl) => dl.content === 'a');
    expect(aLine).toMatchObject({ type: 'unchanged', lineNumberOld: 1, lineNumberNew: 1 });

    // INSERTED is added at new=2
    const inserted = result.find((dl) => dl.content === 'INSERTED');
    expect(inserted).toMatchObject({ type: 'added', lineNumberOld: null, lineNumberNew: 2 });

    // 'b' is now at new=3 (was old=2)
    const bLine = result.find((dl) => dl.content === 'b');
    expect(bLine).toMatchObject({ type: 'unchanged', lineNumberOld: 2, lineNumberNew: 3 });
  });

  it('completely different texts produce only removed + added lines', () => {
    const oldText = 'alpha\nbeta\n';
    const newText = 'gamma\ndelta\n';
    const result = engine.compute(oldText, newText);

    const types = new Set(result.map((dl) => dl.type));
    expect(types.has('unchanged')).toBe(false);
    expect(result.filter((dl) => dl.type === 'removed')).toHaveLength(2);
    expect(result.filter((dl) => dl.type === 'added')).toHaveLength(2);
  });

  it('empty old content produces only added lines', () => {
    const result = engine.compute('', 'x\ny\n');
    expect(result.every((dl) => dl.type === 'added')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('empty new content produces only removed lines', () => {
    const result = engine.compute('x\ny\n', '');
    expect(result.every((dl) => dl.type === 'removed')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('preserves content of each line verbatim', () => {
    const oldText = 'hello world\n';
    const newText = 'hello world\n';
    const result = engine.compute(oldText, newText);
    expect(result[0].content).toBe('hello world');
  });

  it('multiple consecutive insertions are all added with sequential new line numbers', () => {
    const oldText = 'a\nb\n';
    const newText = 'a\nX\nY\nZ\nb\n';
    const result = engine.compute(oldText, newText);

    const added = result.filter((dl) => dl.type === 'added');
    expect(added).toHaveLength(3);
    expect(added[0]).toMatchObject({ content: 'X', lineNumberOld: null, lineNumberNew: 2 });
    expect(added[1]).toMatchObject({ content: 'Y', lineNumberOld: null, lineNumberNew: 3 });
    expect(added[2]).toMatchObject({ content: 'Z', lineNumberOld: null, lineNumberNew: 4 });

    const bLine = result.find((dl) => dl.content === 'b');
    expect(bLine).toMatchObject({ type: 'unchanged', lineNumberOld: 2, lineNumberNew: 5 });
  });

  it('blank lines in the middle of text are preserved as unchanged lines', () => {
    const text = 'a\n\nb\n';
    const result = engine.compute(text, text);

    expect(result).toHaveLength(3);
    expect(result.every((dl) => dl.type === 'unchanged')).toBe(true);
    expect(result[1].content).toBe('');
    expect(result[1]).toMatchObject({ lineNumberOld: 2, lineNumberNew: 2 });
  });
});
