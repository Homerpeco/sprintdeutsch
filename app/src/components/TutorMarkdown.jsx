/**
 * TutorMarkdown — a deliberately small markdown renderer for AI Tutor replies.
 *
 * Why not a library: the tutor emits a narrow, predictable subset (bold, italic,
 * bullets, headings, rules, `[Source: …]`) and pulling in react-markdown +
 * remark would add ~40kB to a bundle that currently ships three dependencies.
 *
 * Why not CSS: `**bold**` arrives as literal characters inside a text node.
 * There is no selector that matches text content, so the asterisks have to be
 * parsed away in JS before any styling can apply.
 *
 * Everything is built as React elements — no dangerouslySetInnerHTML — so model
 * output can never inject markup.
 */

// Affixes are the thing being taught, so they get the loudest treatment:
// bold red. Matches what a grammar book bolds — a fragment hyphenated on the
// side it attaches to: "-d", "ge-", "-ung", "-chen", "un-".
const AFFIX = /^(-[a-zäöüß]{1,8}|[a-zäöüß]{1,8}-)$/i;

// Gemini reaches for LaTeX for arrows even when told not to. Rather than let
// "$\rightarrow$" sit in the middle of a conjugation table, normalise it here —
// the frontend is the last place that can guarantee the learner never sees it.
function stripLatex(s) {
  return s
    .replace(/\$?\\(?:Rightarrow|Longrightarrow)\$?/g, "⇒")
    .replace(/\$?\\(?:rightarrow|longrightarrow|to)\$?/g, "→")
    .replace(/\$?\\(?:Leftarrow|leftarrow)\$?/g, "←")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\quad|\\;|\\,/g, " ")
    // A leftover "$…$" wrapping a short token is dollar-delimited math with
    // nothing mathematical left in it. Unwrap rather than show the dollars.
    .replace(/\$([^$\n]{1,60})\$/g, "$1");
}

/** Inline spans: **bold**, *italic*, `code`. Returns an array of React nodes. */
function renderInline(text, keyPrefix) {
  const out = [];
  // The italic arm requires the opening `*` to be followed by a non-space and
  // the closing one preceded by a non-space — otherwise a stray asterisk
  // ("3 * 4") pairs with the next real emphasis marker and eats the sentence.
  const re = /\*\*([^*]+)\*\*|\*(?![\s*])([^*\n]*[^\s*])\*|`([^`\n]+)`/g;
  let last = 0;
  let m;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));

    const [full, bold, italic, code] = m;
    const key = `${keyPrefix}-i${i++}`;

    if (bold !== undefined) {
      const inner = bold.trim();
      out.push(
        AFFIX.test(inner) ? (
          <strong key={key} className="font-bold text-rose-600">{bold}</strong>
        ) : (
          <strong key={key} className="font-semibold text-slate-900">{bold}</strong>
        )
      );
    } else if (italic !== undefined) {
      // The tutor italicises German words; keep them upright but tinted, which
      // reads better than italics in long vocabulary lists.
      out.push(<em key={key} className="not-italic font-medium text-indigo-700">{italic}</em>);
    } else if (code !== undefined) {
      out.push(
        <code key={key} className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 text-[0.92em] font-mono">
          {code}
        </code>
      );
    }
    last = m.index + full.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Split "Wenn ich Zeit hätte, käme ich. — If I had time, I would come."
 * The tutor is instructed to append an English translation after an em dash;
 * muting it lets the eye land on the German first.
 */
function renderLine(text, keyPrefix) {
  const at = text.indexOf(" — ");
  if (at === -1) return renderInline(text, keyPrefix);
  return [
    ...renderInline(text.slice(0, at), `${keyPrefix}-de`),
    <span key={`${keyPrefix}-tr`} className="text-slate-500">
      {" — "}
      {renderInline(text.slice(at + 3), `${keyPrefix}-en`)}
    </span>,
  ];
}

export function TutorMarkdown({ content, className = "" }) {
  if (!content) return null;

  const lines = stripLatex(content).split("\n");
  const blocks = [];
  let list = null;      // { ordered: bool, items: string[] }
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    blocks.push(
      <p key={`p${blocks.length}`} className="my-1.5 first:mt-0 last:mb-0">
        {renderLine(text, `p${blocks.length}`)}
      </p>
    );
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l${blocks.length}`}
        className={`my-1.5 pl-5 space-y-1 ${list.ordered ? "list-decimal" : "list-disc"} marker:text-slate-400`}
      >
        {list.items.map((it, n) => (
          <li key={n} className="pl-0.5">{renderLine(it, `l${blocks.length}-${n}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };

  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (!t) { flushAll(); continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushAll();
      blocks.push(<hr key={`h${blocks.length}`} className="my-3 border-slate-300" />);
      continue;
    }

    // Heading
    const head = t.match(/^(#{1,6})\s+(.*)$/);
    if (head) {
      flushAll();
      blocks.push(
        <div key={`t${blocks.length}`} className="mt-3 mb-1 first:mt-0 font-semibold text-slate-900 text-[1.02em]">
          {renderInline(head[2], `t${blocks.length}`)}
        </div>
      );
      continue;
    }

    // Citation the tutor appends: [Source: Book, p.42]
    if (/^\[Source:/i.test(t)) {
      flushAll();
      blocks.push(
        <div key={`c${blocks.length}`} className="mt-2 text-[11px] text-slate-500 border-l-2 border-emerald-300 pl-2">
          {t.replace(/^\[|\]$/g, "")}
        </div>
      );
      continue;
    }

    // List item — bullet or numbered
    const bullet = t.match(/^[*\-•]\s+(.*)$/);
    const numbered = t.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((bullet || numbered)[1]);
      continue;
    }

    // A bold-only line ("**Formation:**") is a section label, not a paragraph.
    if (/^\*\*[^*]+\*\*:?$/.test(t)) {
      flushAll();
      blocks.push(
        <div key={`s${blocks.length}`} className="mt-3 mb-1 first:mt-0">
          {renderInline(t, `s${blocks.length}`)}
        </div>
      );
      continue;
    }

    flushList();
    para.push(t);
  }

  flushAll();

  return <div className={className}>{blocks}</div>;
}
