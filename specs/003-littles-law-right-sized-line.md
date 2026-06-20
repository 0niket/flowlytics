# Feature: Little's Law and the right-sized line

The line is a coffee shop. The baskets on it are the crowd, the rate good parts come out is the
serving speed, and the time a basket spends from load to done is the wait. Little's Law locks
these three together: the crowd equals the serving rate times the wait. The dashboard must use
this law to tell the user the right number of baskets to keep on the line, and to warn when the
line is overfed. (Blog: "the crowd in the shop equals how fast you serve times how long each
person stays… You multiply the serving rate by the time in the system, and the result is the
exact crowd the shop can hold.")

This is an additive reframe of values the simulator already computes. It introduces no new
physics.

## Background
Given a simulated run that yields a real serving rate, an average lead time, and an average
  number of work-in-process baskets on the line
And Little's Law maps onto the line as:
  - serving rate: the rate good parts actually come out, in baskets per hour
  - lead time: the time one basket spends from load to done
  - crowd on the line: the average work-in-process baskets currently on the floor
And the right-sized crowd is (serving rate in baskets per hour / 3600) multiplied by the lead time in seconds

## Scenario: The right-sized number of baskets follows from Little's Law
Given a run's real serving rate in baskets per hour and its average lead time in seconds
When the right-sized number of baskets is computed
Then it is (serving rate in baskets per hour divided by 3600) multiplied by the lead time in seconds
And this is a reframe of the throughput, lead time, and work-in-process the simulator already measures, introducing no new physics

## Scenario: Feeding more baskets than the right size is overfeeding
Given a target feed rate of baskets onto the line and a real achieved serving rate
When the target feed rate exceeds the achieved serving rate by more than five percent
Then the run is flagged as overfeeding
And the dashboard can interpret this, per the blog, as feeding faster than the line can serve — the surplus showing up as excess work-in-process rather than added throughput

## Scenario: Excess work-in-process is the crowd above the right size
Given the average work-in-process on the line and the right-sized number of baskets
When excess work-in-process is computed
Then it is the average work-in-process minus the right-sized number, floored at zero
And a line at or below its right size has zero excess

## Scenario: Underfeeding is feed below what the line serves
Given a run whose target feed rate is below its achieved serving rate
When the right-size figures are reported
Then the run is not flagged as overfeeding
And the dashboard reads the target feed rate as below the achieved serving rate, a gap the user can interpret, per the blog, as the line being fed less than it could serve

## Scenario: Overfeeding shows up as excess work-in-process, not more throughput
Given an overfed run and a right-sized run measured by the simulator
When the dashboard compares them
Then the overfed run's measured excess work-in-process is positive while its measured achieved throughput is not higher
And the dashboard presents this as the blog's point — that cramming in baskets lengthens the wait rather than raising throughput — strictly as an interpretation of the measured throughput, lead time, and work-in-process

## Scenario: A right-sized line connects to the money measurements
Given the three-measurements scorecard from spec 002
When the line is overfed
Then Investment (the money trapped in work-in-process) rises without Throughput rising
And the dashboard can show that the trapped money grew while the money coming in did not

## Out of scope
- The visual presentation of the right-size guidance and overfeeding warning (a later UX stage).
- Identifying which stage is the constraint that sets the serving rate (spec 004).
- The five-step loop that acts on an overfed or underfed line (spec 005).
- Changing how lead time, serving rate, or work-in-process are measured by the simulator.
- Pricing the trapped work-in-process (spec 002 defines Investment's value).
