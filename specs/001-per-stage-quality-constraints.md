# Feature: Per-stage quality constraints

Every stage on the line — Loading, each Tank, the WDO, and Unloading — must have a defined
quality constraint, so that a basket which spends the wrong amount of time at any stage is
counted as a violation and its part is not counted as good throughput. (Blog: "not a single
one over-dwells into scrap"; "maximize good throughput at zero violations".)

## Background
Given a configured line with a Loading station, one or more Tanks, an optional WDO, and an
  Unloading station
And each stage's quality constraint is the rule that bounds how long a basket may spend there:
  - a Tank constrains dwell with a target time, a tolerance window around it, and an optional absolute maximum
  - a WDO constrains drying with a target time, a tolerance window around it, and an optional absolute maximum
  - a Loading station constrains its time with an absolute maximum only
  - an Unloading station constrains its time with an absolute maximum only
And a basket that violates a stage's constraint produces a violation at that stage
And a part produced from a violated basket is scrap, not good throughput

## Intended vs. enforced today
The scenarios below the "Enforced today" heading are the current acceptance criteria — they
describe behavior the simulation already produces. The scenarios below the "Not yet enforced"
heading describe intended behavior that is the target of this feature but is not implemented
yet; they are written as pending and are expected to fail until the gap is closed.

# Enforced today

## Scenario: Tank over-dwell is a violation
Given a tank with a target dwell time and a tolerance window
When a basket is picked up from the tank later than the window's upper bound
Then an over-dwell violation is recorded for that basket at that tank
And the violation records the elapsed time, the target dwell, and the tolerance used

## Scenario: Tank under-dwell is a violation
Given a tank with a target dwell time and a tolerance window
When a basket is picked up from the tank earlier than the window's lower bound
Then an under-dwell violation is recorded for that basket at that tank

## Scenario: Tank absolute maximum dwell is a violation
Given a tank that has an absolute maximum dwell time configured
When a basket remains in the tank longer than that absolute maximum, counted from arrival until it leaves
Then a max-time violation is recorded for that basket at that tank
And this is independent of the tolerance-window over-dwell check

## Scenario: WDO over-dwell is a violation
Given a WDO with a target drying time and a tolerance window
When a basket is picked up from the WDO later than the window's upper bound
Then an over-dwell violation is recorded for that basket at the WDO

## Scenario: WDO under-dwell is a violation
Given a WDO with a target drying time and a tolerance window
When a basket is picked up from the WDO earlier than the window's lower bound
Then an under-dwell violation is recorded for that basket at the WDO

## Scenario: A basket with any violation is excluded from good throughput
Given a basket that incurred at least one violation at any stage
When good throughput is counted
Then that basket's part is not counted as a good (sellable) part

## Scenario: A clean basket counts as good throughput
Given a basket that incurred no violations at any stage
When good throughput is counted
Then that basket's part is counted as a good (sellable) part

# Not yet enforced

These scenarios are the target of this feature. Each names a stage whose intended quality
constraint is not detected by the simulation today. They are pending and expected to fail
until implemented. (Current state, for reference: Loading and Unloading detect no violation
of any kind; the WDO detects tolerance-window over/under-dwell but not an absolute maximum.)

## Scenario: Loading exceeds its maximum time (pending)
Given a Loading station that has a maximum loading time configured
When a basket spends longer than that maximum at Loading, counted as total time at the stage from arrival until it leaves (including any waiting)
Then a max-time violation is recorded for that basket at Loading

## Scenario: WDO exceeds its absolute maximum drying time (pending)
Given a WDO that has an absolute maximum drying time configured
When a basket remains in the WDO longer than that absolute maximum, counted as total time at the stage from arrival until it leaves
Then a max-time violation is recorded for that basket at the WDO
And this is independent of the tolerance-window over/under-dwell checks already enforced at the WDO

## Scenario: Unloading exceeds its maximum time (pending)
Given an Unloading station that has a maximum unloading time configured
When a basket spends longer than that maximum at Unloading, counted as total time at the stage from arrival until it leaves (including any waiting)
Then a max-time violation is recorded for that basket at Unloading

## Out of scope
- Defining or changing the numeric default time windows for any stage (handled by config).
- The economic cost of a violation, profit, or any money calculation (spec 002).
- Relating violations to WIP / overfeeding via Little's Law (spec 003).
- Identifying which stage is the system constraint (spec 004).
- How violations are displayed in the UI (a later UX stage).
- The "extra" tank type, which is a no-parameter placeholder with no quality constraint.
