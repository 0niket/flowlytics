export interface GlossaryEntry {
  section: string;
  term: string;
  tags: string;
  def: string;
  cause: string;
  effect: string;
  example: string;
}

export const GLOSSARY_DATA: GlossaryEntry[] = [
  { section: "Key Metrics", term: "Throughput", tags: "baskets per hour bph production rate capacity output",
    def: "Number of baskets fully processed per hour (baskets/hr). This is the primary measure of line productivity.",
    cause: "Determined by the slowest step in the process — the bottleneck. Limited by tank dwell times, wagon speed, manual load/unload duration, and the number of wagons available.",
    effect: "Directly impacts production capacity and customer quotation. Higher throughput means more parts processed per shift, lower unit cost, and a stronger competitive position.",
    example: "A 12-tank line with 2-minute dwell, 1 wagon at 18 m/min achieves ~1.5 bph. Adding a second wagon might push it to 2.2 bph because the wagon was the bottleneck." },

  { section: "Key Metrics", term: "Avg Lead Time", tags: "cycle time total time duration processing time",
    def: "Average total time a basket spends inside the system — from the moment it enters the loading station to when it exits unloading.",
    cause: "Sum of all dwell times + travel times between tanks + manual loading/unloading + waiting time for busy wagons or occupied tanks. With contention, lead time grows beyond the theoretical minimum.",
    effect: "Longer lead times mean more work-in-progress (WIP) on the line, slower response to production changes, and more baskets simultaneously in chemical tanks.",
    example: "Theoretical minimum for 12 tanks at 2 min each + 10 min WDO + 20 min load + 10 min unload = ~64 minutes. Actual lead time of 82 minutes means ~18 minutes of waiting/contention." },

  { section: "Key Metrics", term: "Bottleneck", tags: "constraint limiting factor tank occupied wagon busy load unload",
    def: "The single constraint that most limits throughput. The simulator identifies it by counting how often each type of wait event occurs during the run.",
    cause: "Three bottleneck types: (1) Tank occupied — a basket is ready to move but the next tank already has a basket in it. Fix: reduce dwell time or add a parallel tank. (2) Wagon busy — no wagon is available to move a ready basket. Fix: add wagons or increase speed. (3) Load/Unload busy — the manual station is still processing another basket. Fix: reduce handling time or add a second station.",
    effect: "Resolving the bottleneck is the single most effective optimization. Improving any non-bottleneck step has little to no impact on throughput — the bottleneck still limits the system.",
    example: "If 'Wagon busy' has 425 wait events and 'Tank occupied' has 0, adding tanks won't help at all. Adding a second wagon or increasing wagon speed is the right lever." },

  { section: "Key Metrics", term: "Violations", tags: "over-dwell quality defect chemical tank timing window",
    def: "Over-dwell events — instances where a basket stayed in a chemical tank longer than the maximum allowed time (target dwell + tolerance).",
    cause: "The wagon couldn't pick up the basket in time because it was busy moving another basket. More common in early tanks (T1, T2) where baskets finish first while the wagon is serving later tanks. Also increases with fewer wagons and higher target throughput.",
    effect: "Chemical over-dwell causes surface quality defects: etching, discoloration, hydrogen embrittlement, or corrosion depending on the chemical. Water and rinse tanks are generally safe for over-dwell; acid, alkali, and chromating tanks are critical.",
    example: "T1 shows 8 violations with avg dwell of 3m26s vs target of 2m00s (±10% = max 2m12s). The worst basket stayed 1m14s over the limit — enough to cause visible surface marks on mild steel." },

  { section: "Key Metrics", term: "Wagon Utilization", tags: "busy idle percentage transport efficiency",
    def: "Percentage of total simulation time the wagon spends actively working (traveling to a basket, picking it up, moving it, dropping it) versus sitting idle waiting for a basket to become ready.",
    cause: "Driven by basket count, travel distances between tanks, lift/lower times, pick/drop times, and how many baskets overlap in the system.",
    effect: "High utilization (>85%) means the wagon is near saturation — any delay (e.g., a slow lift) will cascade into violations across the line. Low utilization (<40%) means the wagon has spare capacity and is not the bottleneck.",
    example: "W1 at 86% utilization with 'Wagon busy' as the bottleneck confirms the wagon is the constraint. At 61% utilization with 'Tank occupied' as bottleneck, adding wagons won't help." },

  { section: "Station Metrics", term: "Station Utilization", tags: "tank occupancy percentage busy time",
    def: "Percentage of simulation time a particular tank or station has a basket inside it (is occupied).",
    cause: "Depends on how long baskets dwell (target dwell time), how quickly the wagon delivers and removes baskets, and the overall throughput rate.",
    effect: "Near 100% utilization means the tank is always full — the next basket must wait, creating a 'tank occupied' bottleneck. Very low utilization (e.g., 4%) means the tank is rarely used and the process may not need that many tanks.",
    example: "T1 at 23% utilization and T3 at 29% suggests T3 has slightly longer effective dwell. If any tank hits >90%, it becomes a chokepoint and adding a duplicate tank would help." },

  { section: "Station Metrics", term: "Avg Dwell", tags: "actual dwell time measured immersion duration",
    def: "The actual average time baskets spent immersed in a tank during the simulation, measured from drop to pickup.",
    cause: "Should be close to the target dwell time. Exceeds target when the wagon is too busy to pick up on time (causing over-dwell). The gap between avg dwell and target dwell reveals how much contention exists at that station.",
    effect: "Avg dwell significantly above target indicates the wagon can't keep up — baskets are stuck waiting. This correlates directly with the violation count for that station.",
    example: "T1 with avg dwell 5m38s vs target 2m00s means baskets are sitting 3m38s longer than intended on average. Every one of those baskets likely has a violation." },

  { section: "Station Metrics", term: "Target Dwell", tags: "configured dwell recipe process time chemical",
    def: "The intended chemical process time for a tank — how long a basket should stay immersed, as configured in the recipe.",
    cause: "Set by the chemical process requirements. Different materials need different times: mild steel dismutting might need 2.5 min, aluminum chromating 1.5 min. The tolerance window (±%) defines the acceptable range around this target.",
    effect: "Longer target dwell times reduce throughput because each tank is occupied longer, giving the wagon more baskets to manage simultaneously. Reducing dwell (if the chemistry allows) is a powerful optimization lever.",
    example: "Changing all tanks from 2.5 min to 2.0 min dwell frees up 6 minutes per cycle (12 tanks x 0.5 min), which can increase throughput by 15-20%." },

  { section: "Configuration", term: "Load Time / Unload Time", tags: "manual handling loading unloading basket preparation",
    def: "Manual time required to load parts onto a basket at the loading station, or remove them at the unloading station. These are typically manual operations performed by operators.",
    cause: "Driven by part complexity (number of parts per basket, fixture difficulty), basket design (hooks, racks, fixtures), operator skill, and whether offline preparation is used.",
    effect: "Often a hidden bottleneck. If load time (e.g., 20 min) exceeds the total chemical cycle time (e.g., 12 tanks x 2 min = 24 min), the loading station sets the maximum throughput at 3 baskets/hr regardless of how fast wagons move.",
    example: "With 20 min load time, max throughput = 60/20 = 3 bph. Reducing load time to 15 min (via offline prep) raises the ceiling to 4 bph. If target is 2 bph, load time isn't the bottleneck yet." },

  { section: "Configuration", term: "Drip / Drag-out Time", tags: "chemical carry-over contamination pause lift",
    def: "Mandatory pause time after the wagon lifts a basket out of a tank, before it starts traveling to the next tank. This allows chemicals to drip off the parts back into the tank.",
    cause: "Required by the chemical process to minimize cross-contamination between tanks and reduce chemical loss. Duration depends on part geometry (flat vs complex shapes hold different amounts of liquid).",
    effect: "Adds to every single transfer operation. With 12 tanks, a 15-second drip time adds 12 x 15 = 180 seconds (3 minutes) to the total cycle. Reducing from 15s to 10s saves ~1 minute per basket.",
    example: "At 15s drip, total drip overhead per basket = 13 transfers x 15s = 195s (3m15s). Cutting to 10s saves 65 seconds per basket — about a 4% throughput improvement for free." },

  { section: "Configuration", term: "Wagon Speed", tags: "travel speed transport horizontal rail velocity",
    def: "Horizontal travel speed of the transporter wagon along the rail track, measured in meters per minute.",
    cause: "Limited by the mechanical design of the transporter: motor power, rail quality, load weight, and safety constraints. Typical range is 10–30 m/min for chemical processing lines.",
    effect: "Faster wagons reduce travel time between tanks. With a 12-tank line spanning ~20 meters, increasing from 10 to 18 m/min can cut total travel time per basket by nearly half, reducing lead time and preventing violations.",
    example: "At 10 m/min with 1.4m tank spacing, T1→T2 travel = 1400mm / (10000mm/60s) = 8.4s. At 18 m/min, same trip = 4.7s. Over 13 transfers, that saves ~48 seconds per basket." },

  { section: "Configuration", term: "Lift + Lower Time", tags: "vertical hoist raise lower immerse tank depth",
    def: "Combined time for the wagon to lift a basket out of one tank (raise) and lower it into the next tank (immerse). Includes the vertical travel in both directions.",
    cause: "Depends on tank depth, hoist motor speed, and basket weight. Deeper tanks and heavier baskets take longer. Typical range: 15–30 seconds combined.",
    effect: "Applied at every transfer — the wagon must lift at the source and lower at the destination. With 12 tanks, this operation happens ~26 times per basket (13 lift + 13 lower operations).",
    example: "At 20s lift+lower per transfer, total overhead = 13 transfers x 20s = 260s (4m20s). Reducing to 15s saves 65s per basket. This is often a mechanical constraint that's hard to change." },

  { section: "Configuration", term: "Pick + Drop Time", tags: "grab release clamp mechanism attachment",
    def: "Time for the wagon's grab mechanism to attach to a basket (pick) or release it (drop). Includes clamping, alignment, and safety confirmation.",
    cause: "Mechanical operation of the grab/clamp system. Automated grabs are faster (3–5s) than manual hook operations (10–15s).",
    effect: "Like lift+lower, this is multiplied across every transfer. Typically smaller than lift+lower but still compounds: 13 transfers x 10s = 130s (2m10s) per basket.",
    example: "Upgrading from manual hooks (12s) to automated grabs (5s) saves 7s per transfer x 13 = 91 seconds per basket — a meaningful improvement especially when the wagon is the bottleneck." },

  { section: "Configuration", term: "Tolerance (±%)", tags: "dwell window variation acceptable range chemical process",
    def: "The allowed variation around the target dwell time, expressed as a percentage. A 10% tolerance on a 2-minute target means 1m48s to 2m12s is acceptable.",
    cause: "Determined by the chemical process flexibility. Aggressive chemicals (strong acids) have tight tolerances (±5%). Mild processes (rinses, DM water) can tolerate ±20% or more.",
    effect: "Tighter tolerance = more violations, because the wagon has a smaller window to pick up each basket. Looser tolerance = fewer violations but potentially inconsistent surface treatment quality.",
    example: "At ±10%, a 2-min target gives a 24-second window (1m48s–2m12s). At ±20%, the window doubles to 48 seconds (1m36s–2m24s). Violations might drop from 39 to 5 with the wider window." },

  { section: "Configuration", term: "WDO (Water Dry-Off Oven)", tags: "drying oven heating moisture removal coating prep",
    def: "The Water Dry-Off Oven — a heated chamber at the end of the chemical process line. Baskets pass through to evaporate residual water before powder coating, painting, or assembly.",
    cause: "Required process step. Duration depends on part mass (heavier = more thermal mass), oven temperature, and moisture level. Typically 8–15 minutes.",
    effect: "The WDO is a single-slot resource — only one basket fits at a time. Long WDO times (10+ min) can become a bottleneck if throughput demand is high, since it blocks the station for the entire duration.",
    example: "WDO at 10 min with target 3 bph: the WDO can handle at most 6 baskets/hr (60/10), so it's not the bottleneck. But at target 7 bph, the WDO would need to be under 8.6 min or you need a second oven." },

  { section: "Configuration", term: "# Tanks", tags: "tank count stations process steps chemical baths",
    def: "Number of chemical process tanks in the line between loading and the WDO. Each tank represents one step in the pretreatment recipe (degreasing, rinsing, chromating, etc.).",
    cause: "Determined by the chemical process recipe. More complex surface treatments require more tanks. Typical range: 6–20 tanks.",
    effect: "More tanks = longer travel distance for the wagon, more transfers per basket, and longer lead time. But each individual tank has lower utilization, which reduces 'tank occupied' bottlenecks.",
    example: "12 tanks at 1.4m spacing = 16.8m line. The wagon travels this distance multiple times per basket. Adding a 13th tank adds ~2 min dwell + 2 transfers to each basket's cycle." },

  { section: "Configuration", term: "# Wagons", tags: "wagon count transporter multi-wagon zones",
    def: "Number of rail-mounted transporter wagons operating on the line. Multiple wagons divide the tank range into zones, each wagon serving its zone.",
    cause: "Added when a single wagon can't keep up with demand — i.e., when 'Wagon busy' is the identified bottleneck.",
    effect: "More wagons reduce wait times and violations because baskets get picked up sooner. But wagons cost money and add complexity (zone handover, collision avoidance).",
    example: "1 wagon at 86% utilization with 75 violations. Adding a 2nd wagon drops utilization to ~50% each and violations to near zero, while throughput increases from 1.3 to 2.4 bph." },

  { section: "Configuration", term: "Recipe Preset", tags: "mild steel aluminum custom material process",
    def: "Pre-configured dwell time profiles for common materials. Mild Steel (MS) uses 2.5 min/tank, Aluminum (AL) uses 1.5 min/tank. Custom allows per-tank overrides.",
    cause: "Different materials require different chemical processing times. Mild steel needs longer degreasing and phosphating. Aluminum needs shorter but more sensitive chromating.",
    effect: "Choosing the right preset ensures the simulation reflects realistic processing conditions. Using the wrong preset will produce misleading throughput and violation numbers.",
    example: "Switching from MS (2.5 min) to AL (1.5 min) reduces total dwell by 12 minutes for a 12-tank line, potentially increasing throughput by 30-40%." },

  { section: "Configuration", term: "Target Throughput", tags: "baskets per hour goal quotation demand",
    def: "The desired number of baskets processed per hour. This is the production rate you want to achieve or quote to the customer.",
    cause: "Set by customer demand, production planning, or competitive benchmarking. The simulation compares achieved throughput against this target.",
    effect: "The delta between target and achieved throughput (shown as %) indicates whether the proposed line design can meet demand. A negative delta means the design needs optimization.",
    example: "Target 3.0 bph, achieved 1.33 bph = -55.7% delta. The line design fundamentally cannot meet demand without changes (more wagons, faster speed, shorter dwell)." },

  { section: "Configuration", term: "Simulation Duration", tags: "sim hours run time steady state warm up",
    def: "How many hours of plant operation to simulate. Longer runs produce more accurate steady-state throughput numbers.",
    cause: "The first few baskets always take longer because the line starts empty (warm-up bias). Longer durations dilute this effect and reveal true steady-state performance.",
    effect: "At 1 hour with 2 bph target, only ~2 baskets complete — too few for reliable statistics. At 4 hours, ~8 baskets complete, giving better throughput and violation estimates.",
    example: "A 1-hour sim might show 2.5 bph (optimistic, warm-up bias). A 4-hour sim of the same config shows 1.8 bph (realistic steady-state). Always use 2+ hours for quotations." },

  { section: "Configuration", term: "Distance Model", tags: "manhattan euclidean rail straight line travel",
    def: "How travel distance between stations is calculated. Manhattan (rail) assumes right-angle movement along tracks. Euclidean (straight-line) assumes direct point-to-point travel.",
    cause: "Rail-based transporter systems move along tracks — they can't cut diagonally. Manhattan distance is more realistic for rail systems. Euclidean gives optimistic (shorter) distances.",
    effect: "Manhattan distances are typically 20-40% longer than Euclidean for the same layout, resulting in longer travel times and lower throughput estimates.",
    example: "Two tanks diagonally offset by 5m horizontal and 3m vertical: Euclidean = 5.8m, Manhattan = 8m. At 18 m/min, that's 19s vs 27s travel time — an 8-second difference per transfer." },

  { section: "Loading & Queue", term: "Avg Queue Wait", tags: "loading queue waiting time delay arrival",
    def: "Average time a basket waits in the loading queue before an operator begins loading it. Measured from basket arrival to the start of the loading operation.",
    cause: "Baskets arrive at the target rate (baskets/hr), but loading processes one basket at a time. If a basket arrives while another is being loaded, it queues. The wait grows when arrival rate approaches or exceeds loading capacity.",
    effect: "Long queue waits indicate loading is the bottleneck. Strategies to reduce it: offline basket preparation, faster loading fixtures, or adding a second loading station.",
    example: "At 3 bph target with 20 min load time: one basket every 20 min, load takes 20 min = 100% loading utilization, queue grows continuously. Reducing load to 15 min gives breathing room." },

  { section: "Loading & Queue", term: "Max Queue Depth", tags: "peak queue staging space baskets waiting",
    def: "The highest number of baskets waiting simultaneously at the loading station at any point during the simulation.",
    cause: "Spikes when the arrival rate temporarily exceeds loading capacity, or when loading takes longer than the inter-arrival time. In steady state, if loading is the bottleneck, queue depth grows continuously.",
    effect: "Determines how much physical staging space is needed at the loading area. Also indicates how many pre-prepared baskets you need available. High max depth = need more floor space.",
    example: "Max queue depth of 5 means at peak, 5 baskets were waiting. If each basket is 2m x 1m, you need at least 10 sq meters of staging area plus operator access paths." },

  { section: "Loading & Queue", term: "Loading Utilization", tags: "loading station busy percentage capacity",
    def: "Percentage of simulation time the loading station is actively processing a basket (operator is loading parts).",
    cause: "Function of load time and basket arrival rate. At target 3 bph with 20 min load time: loading is busy 60 min/hr = 100%.",
    effect: "Near 100% means the loading station is at capacity. Above ~85%, any variability (slow operator, difficult parts) causes queue buildup. This is the ceiling on throughput.",
    example: "Loading util at 95% with load time 20 min. The max throughput this station can sustain = 60/20 = 3 bph. To push beyond 3 bph, you must reduce load time or add a parallel station." },

  { section: "Loading & Queue", term: "Baskets Loaded", tags: "completed count processed total",
    def: "Total number of baskets that were loaded during the simulation. This is the count of baskets that entered the system (not necessarily completed).",
    cause: "Determined by the target arrival rate and simulation duration. At 2 bph for 2 hours, approximately 4 baskets are loaded.",
    effect: "Higher basket count gives more statistically reliable simulation results. Very low counts (1-2) make throughput estimates unreliable.",
    example: "4 baskets loaded in 2 hours at 2 bph target. If only 3 completed (1 still in system at simulation end), achieved throughput is calculated from the 3 completed baskets." },

  { section: "Simulation Concepts", term: "Scenario Compare", tags: "comparison baseline alternative what-if analysis",
    def: "Feature to save simulation results as named scenarios (A, B) and compare them side-by-side. Shows how parameter changes affect throughput, lead time, violations, and bottleneck.",
    cause: "Engineers need to evaluate alternatives: 'What if we add a wagon?', 'What if we reduce dwell?', 'What if we speed up loading?'. Scenario comparison quantifies the impact.",
    effect: "Enables data-driven design decisions. Instead of guessing which optimization is most impactful, compare actual simulation results across configurations.",
    example: "Scenario A: 1 wagon, 1.3 bph, 75 violations. Scenario B: 2 wagons, 2.4 bph, 0 violations. The second wagon nearly doubles throughput and eliminates all quality risk." },

  { section: "Simulation Concepts", term: "Basket", tags: "workpiece carrier load parts hanger fixture",
    def: "A carrier (rack, frame, or fixture) that holds parts during chemical processing. Baskets are loaded with parts, transported through tanks by the wagon, and unloaded at the end.",
    cause: "The fundamental unit of production. Each basket carries a payload of parts (typically 500 kg to 2 tons). The basket moves through the entire recipe sequence as a single unit.",
    effect: "Basket throughput (baskets/hr) multiplied by basket payload gives production throughput (kg/hr). Larger baskets = fewer cycles needed but longer load times.",
    example: "At 2 bph with 800 kg/basket = 1,600 kg/hr. Over an 8-hour shift = 12,800 kg/shift. Customer needs 10,000 kg/shift, so 2 bph with 800 kg baskets meets the requirement with 28% margin." },

  { section: "Simulation Concepts", term: "Cycle Time", tags: "single basket total time one cycle complete process",
    def: "Total time for a single basket to complete the entire process from start of loading to end of unloading. Related to but different from lead time — cycle time is for one specific basket, lead time is the average.",
    cause: "Sum of: load time + (travel + lift + lower + drip + dwell) for each tank + WDO time + unload time + any waiting.",
    effect: "The theoretical minimum cycle time (no contention) sets the upper bound on throughput: max_bph = 60 / cycle_time_minutes. Actual throughput is lower due to contention.",
    example: "Theoretical cycle = 20min load + 12x(2min dwell + 30s handling + 15s drip + 5s travel) + 10min WDO + 10min unload = ~72 min. Max theoretical = 60/72 = 0.83 bph per basket slot." },

  { section: "Simulation Concepts", term: "Discrete-Event Simulation (DES)", tags: "simulation engine event loop model",
    def: "The computational method used by Flowlytics. Instead of simulating every second, it jumps between significant events (basket arrives, dwell complete, wagon available) making it fast and accurate.",
    cause: "DES is the standard method for modeling manufacturing systems with shared resources (wagons, tanks) and queuing behavior.",
    effect: "Produces accurate throughput, utilization, and violation metrics that account for real contention between multiple baskets competing for the same wagon and tanks.",
    example: "A 2-hour simulation with 4 baskets generates ~200 events (arrivals, pickups, drops, dwell completions). The event loop processes these in <100ms, much faster than second-by-second simulation." },

  { section: "Layout", term: "DXF / DWG File", tags: "autocad drawing layout floor plan factory cad",
    def: "AutoCAD drawing files containing the factory floor plan with station positions. DXF is an open exchange format readable in the browser. DWG is the native AutoCAD format requiring server-side conversion.",
    cause: "Factory layouts are designed in AutoCAD. The drawing contains text labels (HANGER LOADING, WDO, PROCESS TANK ZONE, etc.) with x,y coordinates that define real station positions.",
    effect: "Loading a DXF/DWG file gives the simulator accurate real-world distances between stations, making travel time calculations and throughput estimates much more reliable than the synthetic layout.",
    example: "A synthetic layout assumes 1.4m spacing. The real factory DXF might show 2.1m spacing with the WDO offset 3m to the side — significantly changing travel times and wagon utilization." },

  { section: "Layout", term: "Synthetic Layout", tags: "generated auto default straight line demo",
    def: "An auto-generated straight-line layout used when no CAD file is available. Places stations in a row with 1.4m spacing: LOAD → T1..T12 → WDO → UNLOAD.",
    cause: "Used for early-stage estimates before the factory CAD drawing is ready, or for quick what-if analysis where exact distances don't matter.",
    effect: "Gives approximate but not accurate travel distances. Useful for comparing recipes and wagon configurations, but not for final quotation accuracy.",
    example: "Synthetic 12-tank layout total line length ≈ 25m. Real factory layout might be 35m with bends — leading to 40% longer travel times than the synthetic estimate." },

  { section: "Layout", term: "Anchor Labels", tags: "hanger loading unloading process tank zone wdo pco",
    def: "Specific text labels in the DXF file that the simulator recognizes as key station positions: HANGER LOADING, HANGER UNLOADING, WDO, PROCESS TANK ZONE, PCO.",
    cause: "These labels are placed by the CAD designer on the factory drawing. The simulator extracts their x,y coordinates to position stations in the simulation model.",
    effect: "If all 5 anchor labels are found, the layout uses real factory positions. If any are missing, the simulator falls back to synthetic positioning for the missing stations.",
    example: "DXF with HANGER LOADING at (733632, 78792) and HANGER UNLOADING at (754211, 80136) gives a real distance of ~20.6m between load and unload stations." },

  { section: "Materials", term: "Mild Steel (MS)", tags: "low carbon steel iron alloy AISI 1018 1020 material preset",
    def: "Low-carbon steel (typically AISI 1018/1020), the most common material processed through pretreatment lines. An alloy of iron with less than 0.25% carbon content. 'MS' is the standard industry abbreviation.",
    cause: "Mild steel requires a multi-step pretreatment to prevent corrosion and prepare the surface for coating: degreasing to remove oils, rinsing, phosphating to create a protective conversion layer, further rinsing, and drying. Each chemical step needs longer dwell times compared to aluminum because the oxide layer is thicker and harder to treat.",
    effect: "The MS preset uses 2.5 min/tank dwell time. With 12 tanks, total chemical dwell is 30 minutes per basket. This longer cycle reduces throughput compared to aluminum but produces a robust phosphate coating essential for paint adhesion and corrosion resistance on steel parts.",
    example: "A typical mild steel pretreatment recipe: T1=3min (alkaline degreasing), T2=2min (rinse), T3=3min (activation), T4=5min (zinc phosphating), T5=2min (rinse), T6=2min (DM water rinse), then WDO. Total chemical time ~17 min before drying." },

  { section: "Materials", term: "Aluminum (AL)", tags: "aluminium alloy chromating anodizing light metal material preset",
    def: "Aluminum alloys used in automotive, aerospace, and consumer goods. Lighter than steel, naturally forms a thin oxide layer, but requires chemical pretreatment (chromating or non-chrome alternatives) for coating adhesion and corrosion protection.",
    cause: "Aluminum is chemically sensitive — it reacts faster than steel in acid/alkali baths. Pretreatment steps are shorter because over-dwell in aggressive chemicals can dissolve the surface (etching), cause discoloration, or create hydrogen embrittlement. The process typically uses chromating or zirconium-based conversion coatings instead of phosphating.",
    effect: "The AL preset uses 1.5 min/tank dwell time. With 12 tanks, total chemical dwell is 18 minutes — 12 minutes less than mild steel. This means higher throughput potential, but the tighter process tolerance makes violations more critical. A 30-second over-dwell in a chromating tank can visibly damage the surface.",
    example: "A typical aluminum pretreatment recipe: T1=2min (mild alkaline clean), T2=1min (rinse), T3=1.5min (chromating), T4=1min (rinse), T5=1min (DM water). Total chemical time ~6.5 min. Faster cycle but zero tolerance for over-dwell in T3." },
];
