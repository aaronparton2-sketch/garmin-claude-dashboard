/**
 * "What to ask for next time": the request sheet, built to be printed and
 * handed across the desk at your next GP visit.
 *
 * THE ONE THING THAT MAKES THIS WORK: in Australia a Medicare rebate attaches
 * to the CLINICAL INDICATION, not to the test name. The same testosterone
 * request is bulk-billed with a documented symptom and out of pocket without
 * one. So every row carries the reason to actually say out loud. That column
 * is the difference between a free panel and a bill, and it is the column a
 * printed list normally leaves out.
 *
 * This is a GENERIC template for an endurance athlete. Edit it to match your
 * own last panel (or have Claude rewrite it off your results). Rebate tiers are
 * deliberately coarse, because eligibility is the GP's call and the rules move:
 *   routine - normally covered as part of a review
 *   reason  - covered, but a symptom or risk factor has to be on the form
 *   paid    - expect to pay; listed anyway because the value is real
 *
 * Not medical advice.
 */

export type Rebate = "routine" | "reason" | "paid";

export const REBATE: Record<Rebate, { label: string; color: string; blurb: string }> = {
  routine: { label: "Usually free", color: "#6ee7b7", blurb: "Normally rebated as part of a general review." },
  reason: { label: "Free with a reason", color: "#38bdf8", blurb: "Rebated when a symptom or risk factor is on the request form." },
  paid: { label: "Expect to pay", color: "#fbbf24", blurb: "Rarely rebated. Worth it anyway. Ask the lab for the fee first." },
};

export type Ask = {
  test: string;
  why: string;
  rebate: Rebate;
  /** The reason to give the GP. Empty when nothing needs saying. */
  say?: string;
};

export type AskGroup = {
  title: string;
  intro: string;
  asks: Ask[];
};

export const NEXT_PANEL: AskGroup[] = [
  {
    title: "1. Repeat everything from the last panel",
    intro:
      "This is the trend baseline. A marker only becomes useful on the second reading, so repeating the full set is worth more than adding new tests.",
    asks: [
      { test: "Full blood count (FBC)", why: "15 markers in one test. Anaemia, immune status, marrow output.", rebate: "routine" },
      { test: "Urea, electrolytes, creatinine (UEC) + eGFR", why: "Kidney function and fluid balance.", rebate: "routine" },
      { test: "Liver function tests (LFT)", why: "Liver enzymes and proteins. Picks up fatty liver early.", rebate: "routine" },
      { test: "Iron studies + ferritin", why: "Ferritin is the number endurance training quietly drains.", rebate: "routine" },
      { test: "Lipids (fasting)", why: "Total, HDL, LDL, triglycerides, ratio.", rebate: "routine" },
      { test: "HbA1c", why: "Three-month average blood sugar. The best metabolic number you get.", rebate: "reason", say: "Annual check, plus family history if you have one." },
      { test: "TSH", why: "Thyroid. Drives energy, weight, cholesterol and CK.", rebate: "routine" },
      { test: "CRP", why: "Baseline inflammation.", rebate: "routine" },
      { test: "Vitamin D", why: "Only comparable against the same season.", rebate: "reason", say: "Ask in late winter, and mention limited sun exposure. The criteria are restricted." },
      { test: "B12 + folate", why: "Nerve function and red cell production.", rebate: "reason", say: "Fatigue, or a low-meat diet if that applies." },
      { test: "Calcium, magnesium, phosphate", why: "Bone minerals, cramps, sleep quality.", rebate: "routine" },
      { test: "CK", why: "Only comparable if you rest beforehand. See the timing rules.", rebate: "routine" },
    ],
  },
  {
    title: "2. Hormones, the usual gap",
    intro:
      "A standard review rarely tests anything endocrine beyond TSH, and TSH says nothing about testosterone. Timing matters more here than for any other test on this sheet.",
    asks: [
      {
        test: "Testosterone (total), 7 to 10am draw",
        why: "Peaks in the morning and falls through the day. An 11am draw reads low and means nothing.",
        rebate: "reason",
        say: "Fatigue, low mood, low libido, poor recovery or strength loss, whichever is actually true. A symptom on the form is what makes it rebatable.",
      },
      {
        test: "SHBG",
        why: "Total testosterone alone is hard to read. SHBG lets them calculate free testosterone, the fraction that actually does anything.",
        rebate: "reason",
        say: "Request it in the same breath as testosterone.",
      },
      {
        test: "LH + FSH",
        why: "Separates a testicular cause from a pituitary one. Only useful if testosterone comes back low.",
        rebate: "reason",
        say: "Ask the GP to add these reflexively if testosterone is low, so you avoid a second trip.",
      },
      {
        test: "Free T4",
        why: "Completes the thyroid picture. Most labs only run it automatically if TSH is abnormal, so it will not appear unless asked.",
        rebate: "reason",
      },
    ],
  },
  {
    title: "3. Metabolic depth, the earliest warning you can get",
    intro:
      "Normal glucose and HbA1c are good news, but insulin rises for years before either of those moves. This is the one place where paying buys genuine early warning.",
    asks: [
      {
        test: "Fasting insulin",
        why: "Insulin climbs to hold glucose steady long before glucose or HbA1c budge. With fasting glucose it gives HOMA-IR, an insulin-resistance score.",
        rebate: "paid",
        say: "Usually out of pocket without a diagnosis. Small fee, high value.",
      },
      { test: "Fasting glucose", why: "Needed alongside insulin to calculate HOMA-IR.", rebate: "routine" },
      { test: "Uric acid", why: "Gout risk, and it tracks with metabolic syndrome.", rebate: "routine" },
    ],
  },
  {
    title: "4. Heart risk, two tests, once in your life",
    intro:
      "These two answer the question standard lipids cannot, and Lp(a) genuinely never needs repeating.",
    asks: [
      {
        test: "Lipoprotein(a), Lp(a)",
        why: "Genetic, set at birth, stable for life. Raises heart risk independently of LDL and is invisible on a standard lipid panel. One test, forever.",
        rebate: "paid",
        say: "Usually no Medicare rebate. Do it once and never again.",
      },
      {
        test: "ApoB",
        why: "Counts the actual number of harmful particles rather than the cholesterol inside them. A better risk marker than LDL.",
        rebate: "paid",
      },
    ],
  },
  {
    title: "5. Chase anything the last panel flagged",
    intro:
      "A flag is a question, not an answer. Low ferritin wants a repeat after a change in diet or a supplement; a high CK wants a rested re-test. Add the follow-up test the lab or GP suggested here so it is not forgotten.",
    asks: [
      {
        test: "Repeat ferritin (if it was low)",
        why: "Confirms whether the fix worked. The number endurance athletes most often run down.",
        rebate: "routine",
        say: "Previous result was low; checking the response.",
      },
      {
        test: "Repeat CK, properly rested (if it was high)",
        why: "A high CK after a hard week is training, not disease. The same test after three easy days settles it.",
        rebate: "routine",
      },
    ],
  },
];

/** The timing rules. Half the flags on a typical athlete's panel are method, not biology. */
export const TIMING: { rule: string; fixes: string }[] = [
  {
    rule: "Book between 7 and 10am",
    fixes: "Testosterone is meaningless outside this window. It also standardises cortisol and iron, which both swing through the day.",
  },
  {
    rule: "Fast 10 to 12 hours, water only",
    fixes: "Triglycerides, glucose and insulin. Keep drinking water; fasting does not mean dehydrated.",
  },
  {
    rule: "Drink properly the day before",
    fixes: "Urea and albumin both read high when you are dry, and both get flagged. Two false alarms, avoided for free.",
  },
  {
    rule: "No hard training for 48 to 72 hours",
    fixes: "CK rises after hard sessions. Training also lifts AST, white cells and ferritin. This one rule probably clears three flags.",
  },
  {
    rule: "Use the same lab every time",
    fixes: "Reference intervals differ between labs, so a marker can appear to move when only the yardstick changed.",
  },
  {
    rule: "Repeat in the same season, roughly 6 months out",
    fixes: "Vitamin D swings hard with season. A summer draw always beats a winter one, so compare like with like.",
  },
];
