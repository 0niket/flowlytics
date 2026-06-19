# Stage 1 — Blog (intent narrative)

The blog is where the feature's **intent** is forged. Its job is not to describe a
solution — it is to interrogate the problem until the goal is **objectively** clear. The
canonical model is `blogs/what-is-the-goal.md`: a Socratic narrative that considers each
candidate answer ("maximize throughput", "minimize cost", "maximize quality"), shows how
each contradicts another, and resolves the tension into a single unambiguous conclusion
("the goal is to make money").

## Why a blog before specs

Specs encode behavior. Behavior is only correct if it serves the right intent. The blog
forces intent to the surface and makes it defensible, so the specs that follow have a
fixed star to navigate by. Every later decision (a spec scenario, a plan step, a UX choice)
should be traceable back to a sentence in the blog.

## Presentation protocol (go slow)

1. **Title + one-paragraph summary first.** Propose a working title and a single paragraph
   that frames the problem and the question the blog will answer. Stop. Get approval.
2. **Then paragraph-by-paragraph.** Write one paragraph at a time. After each, list the
   **bullet reasoning** behind it: what tension it introduces, what assumption it rests on,
   what it rules out. Wait for the user to accept or redirect before the next paragraph.
3. **Surface assumptions explicitly.** Whenever a paragraph relies on something unstated
   ("I'm assuming the operator cost dominates here — confirm?"), name it and ask.
4. **Reach an objective conclusion.** The final section must collapse the competing answers
   into one. If two answers still stand, the blog is not done — keep interrogating. No
   ambiguity may survive into Stage 2.
5. **Glossary appendix with anchors.** Mirror `what-is-the-goal.md`: an `## Appendix` of
   `### <a id="app-term"></a>Term` definitions, with domain terms in the body linked via
   `[term](#app-term)`. Each definition is one tight paragraph, ideally with an authoritative
   reference link.

## Style cues (from `what-is-the-goal.md`)

- **Narrative, not bullet-point spec.** First person, concrete scenes (the factory floor,
  the notebook), dialogue that carries the reasoning.
- **Tension between goals.** Name the levers and show that pulling one breaks another. The
  insight is that the goals are in tension, then that a shared unit (money) reconciles them.
- **Simplify to the smallest case.** Reason from "one tank, one basket, one wagon" upward —
  derive the problem from first principles before scaling to the real line.
- **Objective conclusion.** End on a single, defensible statement of the goal.
- **Draft notes are allowed.** Inline `> _Note: ... needs refinement ..._` blockquotes flag
  unresolved bits for later discussion (as in the real blog's intro note).

## Socratic option-framing with AskUserQuestion

Use `AskUserQuestion` to make intent decisions concrete rather than open-ended. Frame the
genuine alternatives as options with their trade-offs, e.g.:

- *"What is this feature optimizing for?"* → options: Throughput / Quality / Cost / Operator
  ergonomics — each option's `description` states what it implies and what it sacrifices.
- *"Who is the primary user of this feature?"* → Plant owner / Line operator / Analyst.

Put your recommended option first and mark it `(Recommended)`, with the reasoning in its
description. The user can always pick "Other".

## Gate

Do not advance to Stage 2 until the user approves the **full** blog and agrees its
conclusion is unambiguous. The approved conclusion becomes the coverage target for the
specs.
