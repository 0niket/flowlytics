# Feature: The five-step improvement loop, as an LLM coach

The method is a procedure that eats its own tail: find the constraint, wring it dry before
spending a rupee, make the rest of the line serve it, then spend money to make it faster — and
the moment you beat it, start again on the new one. This feature delivers that method as a
chat-based coach: a panel on the right-hand side of the screen where an LLM, given the run's
live data and inputs, walks the user through the five steps and offers concrete adjustments to
the line. (Blog: "Find the constraint, exploit it, subordinate the line to it, elevate it, and
the moment you've beaten it, go find the new one… something Kaka can do on Monday.")

This feature ties the other four together. The coach reasons over the constraint that spec 004
identifies, the right-sized line of spec 003, and the money measurements of spec 002, and it
judges every suggested change by whether good throughput rises at zero new violations (spec 001).

## Background
Given a chat panel on the right-hand side of the screen
And the coach is given the current run's live data: the identified constraint (spec 004), the
  three money measurements (spec 002), the right-sized-line analysis (spec 003), and the
  per-stage violations (spec 001)
And the coach is given the current input values for the line's levers, which the simulator accepts:
  - wagon count, wagon speed, lift/lower and pick/drop times
  - basket count (the feed)
  - the number and arrangement of tanks and the WDO
  - per-stage target times and tolerances
And the coach's job is to guide the user through the five steps in order — Identify, Exploit,
  Subordinate, Elevate, Repeat — using that data
And the coach speaks in the persona of Jonah, the mentor from Goldratt's "The Goal" — a patient
  teacher who leads with Socratic questions and the language of throughput, inventory, and
  operating expense rather than handing over flat answers
And every figure the coach states comes from the simulator, never invented by the coach

## Scenario: The coach opens on the identified constraint
Given a run whose constraint has been identified
When the user opens the coach
Then the coach names the current constraint and explains, in plain language, why it is the slow hand
And it does so before suggesting any change that costs money

## Scenario: The coach grounds its advice in the live run data
Given the coach is answering about the current run
When it cites throughput, work-in-process, profit, the constraint, or violations
Then every such figure is the value the simulator computed for this run
And the coach does not state numbers that the simulator did not produce

## Scenario: The coach answers in Jonah's persona
Given the user asks the coach a question about the line
When the coach responds
Then it answers in the voice of Jonah from "The Goal" — using the three-measurement language and, where it teaches, leading with a Socratic question rather than only a flat instruction
And its persona never changes the figures it reports, which still come only from the simulator

## Scenario: The coach sequences advice by the five steps
Given an identified constraint
When the coach recommends what to do next
Then it first offers free gains at the constraint (Exploit) and feeding the line at the constraint's pace (Subordinate)
And it recommends a money-spending change (Elevate) only once no simulator-backed Exploit or Subordinate quick action remains to offer

## Scenario: The coach offers quick actions that change input values
Given the coach has suggested an adjustment to a lever
When it presents the suggestion in the chat
Then it includes a quick action the user can trigger to apply that change
And triggering the quick action sets the corresponding input value on the line

## Scenario: Applying a quick action re-runs the simulation
Given a quick action that changes a lever's input value
When the user triggers it
Then the line's input is updated and the simulation re-runs
And the coach can then speak to the new run's data, closing the loop

## Scenario: The coach judges a change by good throughput at zero new violations
Given a change has been applied and the simulation has re-run
When the coach assesses whether it was an improvement
Then it calls the change an improvement only if good throughput rose without adding violations (spec 001)
And a change that raised raw output while adding violations is not presented as progress

## Scenario: When the constraint moves, the coach restarts the loop
Given a change that elevates the current constraint enough that another stage becomes the slowest hand
When the simulation re-runs and the constraint is re-identified
Then the coach names the new constraint and begins the five steps again on it
And it makes clear that beating one constraint reveals the next

## Scenario: The coach steers effort to the constraint, not away from it
Given the user asks about, or the coach considers, a change at a stage that is not the constraint
When the coach responds
Then it explains that improving a non-constraint stage does not raise the line's good throughput
And it redirects to the constraint as the place where effort pays off

## Out of scope
- The visual styling of the chat panel and its quick-action controls (a later UX stage).
- Fully automatic optimisation that searches the lever space on its own; the coach suggests
  changes and the user (or a quick action) applies them, then the simulator decides the result.
- The detection of violations (spec 001), the money measurements (spec 002), the right-sized
  line (spec 003), and constraint identification (spec 004); this feature consumes them.
- The choice of LLM provider, prompts, and transport; this spec governs the coach's behavior,
  not its implementation.
- Changing any simulator input ranges or defaults for the levers (handled by config).
