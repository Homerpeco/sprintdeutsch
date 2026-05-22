"""
flashcard_component.py
─────────────────────
Streamlit flashcard UI component for German verb learning.

Swap in your own data by replacing the PLACEHOLDER CARD DATA block
with a lookup from your database/session state.

Run with:
    streamlit run flashcard_component.py
"""

import re
import streamlit as st

# ─────────────────────────────────────────────────────────────────────────────
# PLACEHOLDER CARD DATA
# Replace these variables with your actual data source (e.g. st.session_state,
# a database query, or a dataframe row).
# ─────────────────────────────────────────────────────────────────────────────

card = {
    "en":      "to apply for",       # English translation
    "v":       "beantragen",          # German infinitive
    "lvl":     "B1",                  # CEFR level string
    "present": "er beantragt",        # 3rd-person present conjugation
    "prät":    "er beantragte",       # Präteritum conjugation
    "perf":    "hat beantragt",       # Perfekt conjugation (with auxiliary)
    "ex":      "Er hat gestern einen Antrag beantragt.", # Example sentence
}

# ─────────────────────────────────────────────────────────────────────────────
# SESSION STATE — tracks whether the card is flipped and the result
# ─────────────────────────────────────────────────────────────────────────────

if "flipped" not in st.session_state:
    st.session_state.flipped = False
if "result" not in st.session_state:
    st.session_state.result = None   # None | "known" | "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — bold the conjugated verb form inside the example sentence
#
# Strategy: strip the infinitive ending (-ieren → -ier, -en → stem, etc.) to
# get the verb stem, then find the first word in the sentence that starts with
# that stem and wrap it in <strong>. Falls back to the plain sentence if no
# match is found.
# ─────────────────────────────────────────────────────────────────────────────

def bold_verb_in_sentence(sentence: str, infinitive: str) -> str:
    """Return the sentence as an HTML string with the conjugated verb bolded."""
    if not sentence or not infinitive:
        return sentence

    # Derive stem by progressively stripping common German infinitive endings
    stem = infinitive
    for suffix in ("ieren", "eln", "ern", "en", "n"):
        if stem.endswith(suffix) and len(stem) - len(suffix) >= 3:
            stem = stem[: -len(suffix)]
            break

    if len(stem) < 3:
        return sentence  # stem too short — skip bolding to avoid false matches

    # Build a regex: match any word (letters + umlauts) that starts with the stem
    pattern = re.compile(
        rf'\b({re.escape(stem)}[a-zA-ZäöüÄÖÜß]*)\b',
        flags=re.IGNORECASE
    )

    def replacer(m):
        return f"<strong>{m.group(1)}</strong>"

    # Only replace the first occurrence (the most relevant conjugated form)
    result, count = pattern.subn(replacer, sentence, count=1)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL STYLES
# Injected once per page load via st.markdown unsafe_allow_html.
# ─────────────────────────────────────────────────────────────────────────────

st.markdown("""
<style>
    /* ── Card container ─────────────────────────────────────── */
    .vocab-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        padding: 28px 28px 24px 28px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        margin-bottom: 16px;
    }

    /* ── English translation (small muted) ──────────────────── */
    .card-translation {
        font-size: 0.78rem;
        color: #94a3b8;           /* slate-400 */
        letter-spacing: 0.02em;
        margin-bottom: 2px;
    }

    /* ── German infinitive (large bold) ────────────────────── */
    .card-verb {
        font-size: 2rem;
        font-weight: 800;
        color: #0f172a;           /* slate-900 */
        line-height: 1.15;
        margin-bottom: 0;
    }

    /* ── CEFR level pill ────────────────────────────────────── */
    .level-pill {
        display: inline-block;
        background: #eef2ff;      /* indigo-50 */
        color: #4f46e5;           /* indigo-600 */
        font-size: 0.7rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 9999px;
        letter-spacing: 0.04em;
        float: right;
        margin-top: 4px;
    }

    /* ── Tense matrix labels ────────────────────────────────── */
    .tense-label {
        font-size: 0.65rem;
        color: #94a3b8;           /* slate-400 */
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 2px;
    }

    /* ── Tense values ───────────────────────────────────────── */
    .tense-value {
        font-size: 0.88rem;
        font-weight: 700;
        color: #1e293b;           /* slate-800 */
    }

    /* ── Divider between header and tense grid ──────────────── */
    .card-divider {
        border: none;
        border-top: 1px solid #f1f5f9;   /* slate-100 */
        margin: 18px 0 16px 0;
    }

    /* ── Example sentence callout ───────────────────────────── */
    .example-callout {
        background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
        border: 1px solid #c7d2fe;        /* indigo-200 */
        border-radius: 16px;
        padding: 14px 16px;
        font-size: 0.88rem;
        color: #475569;                   /* slate-600 */
        font-style: italic;
        line-height: 1.6;
        margin-bottom: 4px;
    }
    .example-callout strong {
        font-style: normal;
        color: #0f172a;                   /* slate-900 */
        font-weight: 700;
    }

    /* ── Action buttons ─────────────────────────────────────── */
    div[data-testid="stButton"] > button {
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        padding: 0.6rem 0;
        width: 100%;
        transition: filter 0.15s ease;
    }
    div[data-testid="stButton"] > button:hover {
        filter: brightness(0.95);
    }
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE HEADER  (optional — remove if embedding inside a larger app)
# ─────────────────────────────────────────────────────────────────────────────

st.title("🇩🇪 Vocabulary Drill")
st.caption("Tap **Show answer** to reveal conjugations, then rate yourself.")
st.divider()


# ─────────────────────────────────────────────────────────────────────────────
# ── FRONT FACE  (always visible)
# Shows the German infinitive, English translation, and level tag.
# ─────────────────────────────────────────────────────────────────────────────

with st.container():
    st.markdown(f"""
    <div class="vocab-card">
        <span class="level-pill">{card['lvl']} verb</span>
        <div class="card-translation">{card['en']}</div>
        <div class="card-verb">{card['v']}</div>
    </div>
    """, unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# ── FLIP BUTTON
# Toggles st.session_state.flipped. Sits between front face and back content.
# ─────────────────────────────────────────────────────────────────────────────

flip_label = "Hide answer ↑" if st.session_state.flipped else "Show answer ↓"
if st.button(flip_label, use_container_width=True):
    st.session_state.flipped = not st.session_state.flipped
    st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# ── BACK FACE  (shown only when flipped)
# ─────────────────────────────────────────────────────────────────────────────

if st.session_state.flipped:

    # ── 1. Tense Matrix ───────────────────────────────────────────────────────
    # Three equal columns: Present | Präteritum | Perfekt
    st.markdown("##### Conjugations")

    col_pres, col_prät, col_perf = st.columns(3)

    with col_pres:
        st.markdown('<div class="tense-label">Present</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="tense-value">{card["present"]}</div>', unsafe_allow_html=True)

    with col_prät:
        st.markdown('<div class="tense-label">Präteritum</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="tense-value">{card["prät"]}</div>', unsafe_allow_html=True)

    with col_perf:
        st.markdown('<div class="tense-label">Perfekt</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="tense-value">{card["perf"]}</div>', unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 2. Example Sentence Callout ───────────────────────────────────────────
    # Audio icon column + sentence column, with conjugated verb auto-bolded.
    st.markdown("##### Example")

    col_audio, col_sentence = st.columns([1, 11])

    with col_audio:
        # Placeholder audio button — wire up to st.audio() or a TTS API as needed
        if st.button("🔊", key="audio_btn", help="Play pronunciation"):
            # TODO: Replace with actual TTS call, e.g.:
            #   audio_bytes = text_to_speech(card["ex"])
            #   st.audio(audio_bytes, format="audio/mp3")
            st.toast("Audio coming soon!", icon="🔊")

    with col_sentence:
        highlighted = bold_verb_in_sentence(card["ex"], card["v"])
        st.markdown(
            f'<div class="example-callout">"{highlighted}"</div>',
            unsafe_allow_html=True
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 3. Action Buttons ─────────────────────────────────────────────────────
    # Side-by-side "Didn't know" (rose) and "I knew it" (emerald).
    col_no, col_yes = st.columns(2)

    with col_no:
        # Apply rose styling via custom CSS targeting button index
        st.markdown("""
        <style>
            div[data-testid="stHorizontalBlock"]
            div[data-testid="stButton"]:nth-of-type(1) > button {
                background-color: #fff1f2;
                color: #be123c;
                border: 1px solid #fecdd3;
            }
        </style>
        """, unsafe_allow_html=True)

        if st.button("✗  Didn't know", key="btn_no", use_container_width=True):
            st.session_state.result = "unknown"
            st.session_state.flipped = False
            # TODO: Record result, e.g.:
            #   update_srs(card["v"], known=False)
            st.rerun()

    with col_yes:
        st.markdown("""
        <style>
            div[data-testid="stHorizontalBlock"]
            div[data-testid="stButton"]:nth-of-type(2) > button {
                background-color: #10b981;
                color: #ffffff;
                border: 1px solid #10b981;
            }
        </style>
        """, unsafe_allow_html=True)

        if st.button("✓  I knew it", key="btn_yes", use_container_width=True):
            st.session_state.result = "known"
            st.session_state.flipped = False
            # TODO: Record result, e.g.:
            #   update_srs(card["v"], known=True)
            st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# ── RESULT FEEDBACK  (shown briefly after a button press, before next card)
# ─────────────────────────────────────────────────────────────────────────────

if st.session_state.result == "known":
    st.success("Nice work! Moving this card back in the deck.")
elif st.session_state.result == "unknown":
    st.warning("No worries — you'll see this card again soon.")


# ─────────────────────────────────────────────────────────────────────────────
# ── FOOTER NOTE
# ─────────────────────────────────────────────────────────────────────────────

st.markdown(
    "<p style='text-align:center; font-size:0.72rem; color:#94a3b8; margin-top:24px;'>"
    "Progress is saved locally on this device.</p>",
    unsafe_allow_html=True
)
