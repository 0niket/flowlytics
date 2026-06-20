# Feature: Identifying the constraint (the slow hand)

The line moves only as fast as its slowest hand, and an hour lost there is an hour lost by the
whole line. The dashboard must identify which stage is actually the constraint — on the numbers,
not on a guess — and it must tell the difference between a stage that is the constraint and a
stage that merely looks busy. (Blog: "find the slow hand. Not where you think it is. Where it
actually is, on the numbers"; "a wagon running flat out only helps if it is running flat out
serving, not chasing a backlog.")

This builds on values the simulator already produces, and names an explicit gap where the
constraint of a stage is not yet identified.

## Background
Given a simulated run that records, for every location on the line, how long baskets waited
  there, and that records utilization for the wagons and the stations
And the constraint is the stage that most limits the rate good parts come out — the slowest hand
And a stage can be highly utilized without being the constraint, and a stage starved of work is
  a signal that the real constraint is upstream
And the simulator already exposes a single overall bottleneck signal: the location where baskets
  accumulated the most waiting

## Intended vs. enforced today
Scenarios under "Enforced today" describe behavior the simulator already produces. Scenarios
under "Not yet enforced" describe intended behavior that is the target of this feature; they are
pending and expected to fail until implemented.

# Enforced today

## Scenario: The overall bottleneck is the location with the most waiting
Given a run in which baskets waited at several locations
When the overall bottleneck is reported
Then it is the location where baskets accumulated the most total waiting time

## Scenario: Loading is identified as a constraint when demand exceeds its service rate
Given a Loading station whose service rate is the baskets per hour it can process
And an arrival rate bounded by the unloading service rate and the line's theoretical maximum
When the arrival rate exceeds the Loading service rate
Then Loading is flagged as a bottleneck
And its explanation describes the queue building up because demand outpaces its service rate

## Scenario: Unloading is identified as a constraint when demand exceeds its service rate
Given an Unloading station whose service rate is the baskets per hour it can process
And an arrival rate bounded by the loading service rate and the line's theoretical maximum
When the arrival rate exceeds the Unloading service rate
Then Unloading is flagged as a bottleneck
And its explanation describes the queue building up because demand outpaces its service rate

## Scenario: A starved station is flagged as not the constraint
Given a Loading or Unloading station whose service rate comfortably exceeds the work arriving at it
When its utilization is well below its capacity
Then it is flagged as underutilized rather than as the constraint
And the report states that the real constraint is upstream, not this station

## Scenario: A Loading or Unloading station is judged by service-versus-demand, not busyness
Given a Loading or Unloading station
When its constraint analysis runs
Then whether it is the bottleneck is decided by its service rate against the arrival rate, not by how busy it is
And a station whose service rate keeps up with demand is not marked the constraint even if it is busy

# Not yet enforced

These scenarios are the target of this feature. Today the simulator deep-analyzes only Loading
and Unloading as named constraints, and otherwise exposes only the single most-waited-at
location. The wagon and the processing stages are not yet identified as the constraint in their
own right. (For reference: the wagon is, per the blog, the usual constraint on this line.)

## Scenario: The wagon is identified as the constraint when it sets the pace (pending)
Given a run in which the wagon is the slowest hand — its capacity to move baskets limits the rate good parts come out
When the constraint is reported
Then the wagon is named as the constraint
And the report explains that the wagon's moving capacity, not a station's service rate, is what limits throughput

## Scenario: A processing stage is identified as the constraint when it sets the pace (pending)
Given a run in which a tank or the WDO is the slowest hand that limits the rate good parts come out
When the constraint is reported
Then that stage is named as the constraint
And the report distinguishes it from stages that are merely highly utilized

## Scenario: The constraint is reported with the measure that justifies it (pending)
Given a stage identified as the constraint
When the constraint is reported
Then the report includes the measured figure that makes it the constraint — its service or moving capacity against the demand placed on it
And a user can see why this stage, and not another, is the slow hand

## Out of scope
- Acting on the constraint — exploiting, subordinating, or elevating it (spec 005).
- The visual presentation of the constraint and its justification (a later UX stage).
- The per-stage quality violations themselves (spec 001).
- The three money measurements (spec 002) and the right-sized line (spec 003), though the
  constraint is what sets the serving rate those specs depend on.
- Changing how waits, utilization, or service rates are measured by the simulator.
