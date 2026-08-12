// Reader for the restricted Lua-literal grammar gen1recomp writes.
//
// src/core/SaveSerializer.lua is the specification: `return <value>` where a
// value is a number, a boolean, a %q string, or a keyed table.  No function
// calls, no operators, no varargs -- so this is a parser, never an evaluator,
// and a hand-tampered options.lua or .g1rmodlist fails to parse instead of
// doing anything.  We deliberately mirror the engine's own reader rather than
// reaching for a Lua VM: a pack tool that can execute a shared file is exactly
// the thing the .g1rmodlist format was careful not to be.
//
// Tables come back as plain objects.  Lua's 1-based integer keys land as the
// string keys "1", "2", ... -- use toArray() when you want them in order.

const MAX_DEPTH = 128;

// The letter escapes %q emits across the Lua 5.x family.  LuaJIT writes control
// characters as \ddd decimal instead, handled separately in readString.
const ESCAPES = {
  '"': '"', '\\': '\\', n: '\n', r: '\r', t: '\t',
  a: '\x07', b: '\b', f: '\f', v: '\v',
  '\n': '\n', '\r': '\n',
};

class LuaParseError extends Error {}

class Reader {
  constructor(src) {
    this.src = src;
    this.pos = 0;
    this.depth = 0;
  }

  fail(why) {
    throw new LuaParseError(`parse error at byte ${this.pos}: ${why}`);
  }

  skip() {
    while (this.pos < this.src.length && ' \t\r\n'.includes(this.src[this.pos])) {
      this.pos++;
    }
  }

  peek() {
    return this.src[this.pos] ?? '';
  }

  // Consume `word` when it is next and not glued to a longer identifier.
  eatWord(word) {
    if (this.src.startsWith(word, this.pos)) {
      const after = this.src[this.pos + word.length] ?? '';
      if (!/[\w]/.test(after)) {
        this.pos += word.length;
        return true;
      }
    }
    return false;
  }

  readString() {
    const out = [];
    let i = this.pos + 1; // skip the opening quote
    for (;;) {
      const c = this.src[i];
      if (c === undefined) {
        this.pos = i;
        this.fail('unterminated string');
      } else if (c === '"') {
        this.pos = i + 1;
        return out.join('');
      } else if (c === '\\') {
        const next = this.src[i + 1] ?? '';
        if (/\d/.test(next)) {
          const digits = /^\d{1,3}/.exec(this.src.slice(i + 1))[0];
          const code = Number(digits);
          if (code > 255) {
            this.pos = i;
            this.fail('escape out of range');
          }
          out.push(String.fromCharCode(code));
          i += 1 + digits.length;
        } else if (next in ESCAPES) {
          out.push(ESCAPES[next]);
          i += 2;
        } else {
          this.pos = i;
          this.fail('bad string escape');
        }
      } else {
        out.push(c);
        i++;
      }
    }
  }

  readNumber() {
    const m = /^-?(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)/
      .exec(this.src.slice(this.pos));
    if (!m) this.fail('bad number');
    this.pos += m[0].length;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) this.fail('bad number');
    return n;
  }

  readTable() {
    if (++this.depth > MAX_DEPTH) this.fail('table nested too deep');
    this.pos++; // {
    const out = {};
    for (;;) {
      this.skip();
      const c = this.peek();
      if (c === '') this.fail('unterminated table');
      if (c === '}') {
        this.pos++;
        this.depth--;
        return out;
      }

      let key;
      if (c === '[') {
        this.pos++;
        this.skip();
        key = this.readValue();
        if (typeof key !== 'string' && typeof key !== 'number') {
          this.fail('table key must be a string or number');
        }
        this.skip();
        if (this.peek() !== ']') this.fail("expected ']' after table key");
        this.pos++;
      } else {
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.src.slice(this.pos));
        if (!m) this.fail('expected a table key');
        key = m[0];
        this.pos += m[0].length;
      }

      this.skip();
      if (this.peek() !== '=') this.fail("expected '=' after table key");
      this.pos++;
      this.skip();
      out[String(key)] = this.readValue();

      this.skip();
      if (this.peek() === ',' || this.peek() === ';') this.pos++;
      else if (this.peek() !== '}') this.fail("expected ',' or '}'");
    }
  }

  readValue() {
    this.skip();
    const c = this.peek();
    if (c === '') this.fail('unexpected end of input');
    if (c === '"') return this.readString();
    if (c === '{') return this.readTable();
    if (this.eatWord('true')) return true;
    if (this.eatWord('false')) return false;
    if (this.eatWord('nil')) return null;
    if (c === '-' || c === '.' || /\d/.test(c)) return this.readNumber();
    this.fail(`unexpected character ${JSON.stringify(c)}`);
  }
}

// parse(source) -> value.  Accepts the `return <value>` the writer emits, and
// a bare value too, so a fragment lifted out of a file still reads.
export function parse(source) {
  if (typeof source !== 'string') throw new LuaParseError('source must be a string');
  const r = new Reader(source);
  r.skip();
  r.eatWord('return');
  const value = r.readValue();
  r.skip();
  if (r.pos < r.src.length) r.fail('trailing content after value');
  return value;
}

// Lua's 1-based sequence out of a parsed table, stopping at the first hole --
// the same thing ipairs() would have walked.
export function toArray(table) {
  const out = [];
  if (!table || typeof table !== 'object') return out;
  for (let i = 1; ; i++) {
    const v = table[String(i)];
    if (v === undefined) return out;
    out.push(v);
  }
}

export { LuaParseError };
