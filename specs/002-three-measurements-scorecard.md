# Feature: The three-measurements scorecard

The dashboard must present the line through the three measurements the blog identifies as the
only money that moves: the money coming **in**, the money going **out**, and the money
**trapped**. (Blog: "Three kinds of money move through Kaka's line… money in, money out, money
stuck. And profit… was the gap between the first and the second, dragged on by the third.")

This is an additive reframe of numbers the simulator already produces. It introduces no new
physics and removes nothing from the existing dashboard.

## Application boundary
The blog's ideal is that only a *good* (non-violated) part is income. This application bills at
a coarser boundary: **a basket is billed when it is unloaded.** Any basket that reaches
Unloading is treated as revenue earned, regardless of violations along the way. This is a
deliberate simplification — the line stops tracking a part once it is unloaded — so Throughput
here counts unloaded baskets, not strictly-clean baskets. (Violations are still defined and
surfaced per spec 001; they simply do not reduce this Throughput figure.)

## Background
Given a simulated run that already yields throughput, per-stage costs, capital outlay, and
  work-in-process baskets
And the three measurements are defined as:
  - Throughput (T): the rate of money coming in, billed when baskets are unloaded
  - Operating Expense (OE): the rate of money going out to run the line — raw material,
    chemicals, labour, energy, maintenance, depreciation, and the WDO. Most of these accrue
    whether or not the line ships anything; raw material scales with what it produces.
  - Investment (I): the money trapped in the line — the value of the average work-in-process
    baskets on the floor
And these map onto values the simulator already computes; the scorecard only renames and
  regroups them

## Scenario: Throughput is the billed value of unloaded baskets
Given a run that unloads baskets at a steady rate
And a sale value per unloaded basket
When Throughput is computed
Then it is the number of baskets unloaded per hour multiplied by the sale value per basket
And a basket counts toward Throughput once it is unloaded, regardless of any violations it incurred

## Scenario: Operating Expense is the cost of running the line
Given the per-hour raw-material, chemical, labour, energy, maintenance, depreciation, and WDO costs
When Operating Expense is computed
Then it is the sum of those per-hour costs
And it is the full money-out figure the dashboard already totals as cost today, so net profit can reconcile exactly

## Scenario: Investment is the work-in-process trapped on the line
Given the average number of work-in-process baskets on the line and a per-basket value
When Investment is computed
Then it is the average work-in-process count multiplied by the per-basket value
And equipment and wagon capital is not part of Investment; it is tracked separately as a capital cost

## Scenario: Net profit is Throughput minus Operating Expense
Given Throughput (gross billed value of unloaded baskets) and Operating Expense (full money-out including raw material)
When net profit is computed
Then net profit is Throughput minus Operating Expense
And because Throughput is gross revenue and Operating Expense is the full cost the dashboard already totals, this equals the profit-per-hour the dashboard reports today, so the reframe does not change the bottom line

## Scenario: Return on the trapped money is profit over Investment
Given net profit and Investment for a run
When return on investment is computed
Then it is net profit divided by Investment
And a run that makes the same profit with fewer baskets trapped on the line shows a higher return

## Scenario: Equipment capital stays a separate figure
Given the capital tied up in wagons and station equipment
When the scorecard is shown
Then that capital appears as its own figure, separate from the three measurements
And it continues to feed cost and profit exactly as the dashboard computes today

## Scenario: The scorecard preserves the existing dashboard
Given the dashboard already shows throughput, operating cost, and fixed cost
When the three-measurements scorecard is added
Then every existing figure remains available
And the scorecard is an additional framing layered over them, not a replacement

## Out of scope
- The visual design of the scorecard — cards, colours, layout (a later UX stage).
- Detecting or pricing violations themselves (spec 001 defines violations; this spec does not
  let violations reduce Throughput, per the application boundary above).
- Relating Investment to the right-sized line via Little's Law (spec 003).
- Identifying which stage is the constraint (spec 004).
- The five-step improvement loop that acts on the scorecard (spec 005).
- Changing any numeric cost, price, or capital default (handled by config).
