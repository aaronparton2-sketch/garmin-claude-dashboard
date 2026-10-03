/**
 * Per-marker reference knowledge: what a test measures, and what it means when
 * it runs high or low.
 *
 * WHY THIS LIVES IN CODE AND NOT IN THE PANEL DATA: this is stable knowledge
 * about a test, not a measurement. Storing it per panel would duplicate every
 * word on every re-test and let two panels disagree about what ferritin is.
 * Keyed by BloodMarker.key, so a new panel inherits all of it for free.
 *
 * Written to be READ ON HOVER — short clauses, causes first, effects second.
 * Not paragraphs. If a line needs a comma splice to fit, cut it instead.
 *
 * Not medical advice. Causes are the common ones, not the complete list.
 */

export type MarkerInfo = {
  /** One line: what the test actually measures. */
  what: string;
  /** Common causes of a high result, then what high does to you. */
  high: string;
  /** Same for low. */
  low: string;
  /** Optional: why this one is worth trending, when that is not obvious. */
  track?: string;
};

export const MARKER_INFO: Record<string, MarkerInfo> = {
  /* ---------------------------------------------------------- iron studies */
  iron: {
    what: "Iron circulating in your blood at the moment of the draw.",
    high: "Iron supplements, a recent meal, haemochromatosis, liver damage releasing stores.",
    low: "True deficiency — but it also swings hour to hour and drops through the day.",
    track: "Too noisy to trend on its own. Ferritin is the number that matters.",
  },
  transferrin: {
    what: "The protein that carries iron around the body.",
    high: "Iron deficiency — the body builds more carriers to scavenge what is left.",
    low: "Chronic inflammation, liver disease, malnutrition, iron overload.",
  },
  transferrin_sat: {
    what: "What percentage of your iron carriers are actually loaded with iron.",
    high: "Above 45% points at iron overload or haemochromatosis.",
    low: "Below 15% is one of the earliest reliable signs of iron deficiency.",
  },
  ferritin: {
    what: "Your stored iron. The savings account, not the day-to-day cash.",
    high: "Iron overload — but it also rises with inflammation, infection, liver disease and alcohol independently of iron.",
    low: "Definitive iron deficiency. Fatigue and flat training show up here long before haemoglobin drops.",
    track: "The single most useful iron number to trend. Endurance training drains it over years.",
  },

  /* -------------------------------------------------------------- vitamins */
  folate: {
    what: "Folate, needed to build red blood cells and DNA.",
    high: "Supplementation. Rarely a problem, but it can mask a B12 deficiency underneath.",
    low: "Poor intake, alcohol, coeliac or other malabsorption. Causes large red cells and anaemia.",
  },
  vitamin_d: {
    what: "Vitamin D stores. Bone, muscle and immune function.",
    high: "Over-supplementation. Very high levels can push calcium up.",
    low: "Little sun, winter, covered skin. Causes bone loss, muscle weakness, frequent infections, low mood.",
    track: "Only compare same-season draws. A summer reading always beats a winter one.",
  },
  b12: {
    what: "Total vitamin B12. Nerve function and red cell production.",
    high: "Supplements. Occasionally liver disease or a blood disorder.",
    low: "Vegan or vegetarian diet, metformin, reflux meds, pernicious anaemia, poor gut absorption. Causes fatigue, pins and needles, and nerve damage that can become permanent.",
  },
  active_b12: {
    what: "The fraction of B12 your cells can actually use. The tie-breaker when total B12 is borderline.",
    high: "Means you are replete. Not a condition.",
    low: "True B12 deficiency, even when total B12 reads normal.",
  },

  /* ---------------------------------------------------------- inflammation */
  crp: {
    what: "General inflammation anywhere in the body.",
    high: "Infection, injury, autoimmune flare, recent hard training, excess body fat. Persistently mild elevation tracks cardiovascular risk.",
    low: "The goal. Nothing to interpret.",
  },

  /* ---------------------------------------------------------------- muscle */
  ck: {
    what: "Creatine kinase — an enzyme that leaks out of muscle when it is stressed or damaged.",
    high: "Hard or eccentric training is the common one. Also statins, hypothyroidism, viral myositis, crush injury. Thousands plus dark urine is rhabdomyolysis and an emergency.",
    low: "Not meaningful.",
    track: "Only comparable if you rest 2–3 days before every draw.",
  },

  /* ------------------------------------------------ kidneys & electrolytes */
  urea: {
    what: "Protein waste your kidneys clear.",
    high: "Dehydration, high protein intake, hard training, gut bleeding, kidney impairment.",
    low: "Low protein intake, liver disease, over-hydration.",
    track: "Always read next to creatinine. Urea up with creatinine normal is hydration, not kidneys.",
  },
  creatinine: {
    what: "Muscle breakdown product cleared by the kidneys. The workhorse kidney marker.",
    high: "Kidney impairment — but also high muscle mass, creatine supplements, dehydration.",
    low: "Low muscle mass. Not a concern on its own.",
  },
  egfr: {
    what: "Estimated filtration rate — how fast your kidneys clean the blood.",
    high: "Above 90 is normal and good.",
    low: "Under 60 sustained for three months defines chronic kidney disease.",
    track: "Estimated from creatinine assuming average muscle mass, so it under-reads in muscular people.",
  },
  sodium: {
    what: "The main driver of your body's water balance.",
    high: "Dehydration, not enough water.",
    low: "Over-drinking — a real endurance-sport risk. Also some meds and adrenal problems. Severe or rapid drops cause confusion and seizures.",
  },
  potassium: {
    what: "Nerve signalling and heart muscle rhythm.",
    high: "Kidney impairment, some blood pressure meds — or a squeezed sample, which is a very common false result. Real elevation risks dangerous heart rhythms.",
    low: "Vomiting, diarrhoea, diuretics, heavy sweating. Causes cramps, weakness, palpitations.",
  },
  chloride: {
    what: "Moves with sodium. Fluid and acid-base balance.",
    high: "Dehydration, metabolic acidosis.",
    low: "Vomiting, diuretics.",
  },
  bicarbonate: {
    what: "Your blood's acid buffer.",
    high: "Vomiting, diuretics, chronic over-breathing.",
    low: "Metabolic acidosis — hard exercise, ketosis, diarrhoea, kidney disease.",
  },

  /* ------------------------------------------------------- bone & minerals */
  magnesium: {
    what: "Cofactor in hundreds of enzymes. Muscle and nerve function.",
    high: "Rare. Usually kidney impairment or heavy supplementation.",
    low: "Poor diet, alcohol, diuretics, reflux meds, heavy sweating. Causes cramps, twitching, palpitations, poor sleep.",
    track: "Serum magnesium is insensitive — you can be depleted with a normal reading.",
  },
  corrected_calcium: {
    what: "Blood calcium, adjusted for your albumin level. The figure that actually counts.",
    high: "Overactive parathyroid, excess vitamin D, some cancers. Causes kidney stones, constipation, aches, low mood.",
    low: "Vitamin D deficiency, underactive parathyroid, kidney disease. Causes tingling, cramps, muscle spasm.",
  },
  phosphate: {
    what: "Partners calcium in bone, and carries cellular energy as ATP.",
    high: "Kidney impairment.",
    low: "Refeeding, alcohol, antacids, vitamin D deficiency. Causes muscle weakness.",
  },

  /* ----------------------------------------------------------------- liver */
  ast: {
    what: "An enzyme found in liver, but also in muscle and heart.",
    high: "Liver injury or alcohol — but hard training raises it too. Read next to CK before blaming the liver.",
    low: "Not meaningful.",
  },
  alt: {
    what: "The more liver-specific of the two liver enzymes.",
    high: "Fatty liver is the commonest cause by far. Also alcohol, viral hepatitis, some meds and supplements.",
    low: "Not meaningful.",
  },
  alp: {
    what: "An enzyme from the liver's bile ducts and from bone.",
    high: "Bile duct obstruction, bone growth or healing, pregnancy.",
    low: "Rare. Malnutrition, low zinc.",
  },
  ggt: {
    what: "The liver enzyme most sensitive to alcohol.",
    high: "Alcohol, fatty liver, bile duct problems, some meds. A rising GGT with everything else normal usually means alcohol or fatty liver.",
    low: "Not meaningful.",
  },
  bilirubin: {
    what: "Red cell breakdown product that the liver clears.",
    high: "Gilbert's syndrome — harmless, common, worse when fasting or stressed. Also haemolysis or bile obstruction. Above roughly 40 you go yellow.",
    low: "Not meaningful.",
  },
  total_protein: {
    what: "Albumin and globulin added together.",
    high: "Dehydration, chronic inflammation, myeloma.",
    low: "Malnutrition, liver disease, protein lost through kidneys or gut.",
  },
  albumin: {
    what: "The main blood protein. Made by the liver, carries hormones, calcium and drugs.",
    high: "Almost always just concentrated blood — dehydration at the time of the draw.",
    low: "Liver disease, kidney loss, malnutrition, inflammation. Causes fluid to leak into tissues.",
  },
  globulin: {
    what: "Immune antibodies and transport proteins.",
    high: "Chronic infection, inflammation, autoimmune disease, myeloma.",
    low: "Immune deficiency, liver disease.",
  },

  /* --------------------------------------------------------------- thyroid */
  tsh: {
    what: "The pituitary hormone that tells your thyroid how hard to work. It moves OPPOSITE to thyroid output.",
    high: "Underactive thyroid. Causes fatigue, weight gain, feeling cold, constipation, low mood — and raises CK and cholesterol.",
    low: "Overactive thyroid. Causes weight loss, tremor, heat intolerance, palpitations, anxiety.",
  },

  /* ---------------------------------------------------------------- lipids */
  cholesterol: {
    what: "Total cholesterol — LDL plus HDL plus the rest.",
    high: "Usually LDL. But a high protective HDL pushes this up too, which is why total alone is a poor risk marker.",
    low: "Rarely an issue.",
    track: "Never read this without HDL next to it.",
  },
  triglycerides: {
    what: "Fat circulating in the blood.",
    high: "Refined carbs, alcohol, poor insulin sensitivity, or simply not fasting. Very high risks pancreatitis.",
    low: "Good.",
    track: "One of the two lipid numbers that genuinely tracks risk in a young person.",
  },
  hdl: {
    what: "The protective particle. Carries cholesterol back to the liver for disposal.",
    high: "Good. Exercise, healthy fats and moderate alcohol raise it.",
    low: "Sedentary living, smoking, insulin resistance. This is the one where you want a high number.",
  },
  chol_hdl_ratio: {
    what: "Total cholesterol divided by HDL. A single risk figure.",
    high: "Worse cardiovascular risk.",
    low: "Better. Under 3.5 is good, under 4.5 acceptable.",
  },
  ldl: {
    what: "The particle that actually drives plaque in your arteries.",
    high: "Saturated fat, genetics, underactive thyroid. No symptoms whatsoever — it builds silently over decades.",
    low: "Good, with no known downside at these levels.",
  },
  non_hdl: {
    what: "Everything harmful in one number — total minus HDL.",
    high: "Worse risk. Increasingly preferred over LDL because it captures all harmful particles and does not need fasting.",
    low: "Good.",
  },

  /* ------------------------------------------------------------- metabolic */
  glucose: {
    what: "Blood sugar at the exact moment of the draw.",
    high: "A recent meal if random. If fasting, points at pre-diabetes or diabetes.",
    low: "Too long without food. Causes shakiness and confusion.",
    track: "A single reading is nearly meaningless. HbA1c is the one to trend.",
  },
  hba1c_pct: {
    what: "Average blood sugar over about three months, measured as sugar stuck to red cells.",
    high: "6.0–6.4% is pre-diabetes. 6.5% and over is diabetes.",
    low: "Can read falsely low if red cells turn over fast — blood loss, haemolysis, recovering iron deficiency.",
    track: "The single best metabolic number you have. Cannot be gamed by one good morning.",
  },
  hba1c_mmol: {
    what: "The same three-month average in international units.",
    high: "42–47 is pre-diabetes. 48 and over is diabetes.",
    low: "Same caveat as the percentage.",
  },
  uric_acid: {
    what: "Waste product from breaking down purines.",
    high: "Gout and kidney stones. Driven by alcohol, red meat, fructose. Also tracks with metabolic syndrome.",
    low: "Usually harmless. Some medications.",
  },

  /* ---------------------------------------------------- osmolality & urine */
  serum_osmolality: {
    what: "How concentrated your blood is.",
    high: "Dehydration, high blood sugar, diabetes insipidus.",
    low: "Over-drinking, or hormone problems holding onto water.",
    track: "Read with sodium. Normal on both effectively rules out a serious water-balance disorder.",
  },
  urine_osmolality: {
    what: "How concentrated your urine is — whether the kidneys are conserving water or dumping it.",
    high: "Kidneys conserving water. Normal and expected when you are dehydrated.",
    low: "Dilute urine. Either you drink a lot, or the kidneys cannot concentrate.",
    track: "A random sample cannot tell those two apart. A morning sample after no fluids from 6pm can.",
  },
  urine_leucocytes: {
    what: "White cells in the urine.",
    high: "Urinary tract infection or inflammation.",
    low: "Normal.",
  },
  urine_erythrocytes: {
    what: "Red cells in the urine.",
    high: "Infection, kidney stones, intense exercise. Persistent blood always gets investigated.",
    low: "Normal.",
  },

  /* ----------------------------------------------------------- blood count */
  haemoglobin: {
    what: "The pigment that carries oxygen to your muscles.",
    high: "Dehydration, altitude, smoking, polycythaemia. Thickens the blood.",
    low: "Anaemia. Causes fatigue, breathlessness and flat training. From iron, B12 or folate deficiency, bleeding, or chronic disease.",
  },
  rcc: {
    what: "How many red blood cells you have.",
    high: "Dehydration, altitude, polycythaemia.",
    low: "Anaemia, over-hydration, blood loss.",
  },
  haematocrit: {
    what: "The percentage of your blood volume made up of red cells.",
    high: "Dehydration, altitude training.",
    low: "Anaemia or over-hydration. Endurance athletes often read low simply from expanded plasma volume — that is not real anaemia.",
  },
  mcv: {
    what: "Average red cell size. The best single clue to WHY someone is anaemic.",
    high: "B12 or folate deficiency, alcohol, underactive thyroid, some medications.",
    low: "Iron deficiency or thalassaemia.",
  },
  mch: {
    what: "Average amount of haemoglobin per red cell. Tracks with MCV.",
    high: "Large-cell anaemia — B12 or folate.",
    low: "Iron deficiency, thalassaemia.",
  },
  mchc: {
    what: "How concentrated the haemoglobin is inside each cell.",
    high: "Spherocytosis, or a lab artefact.",
    low: "Iron deficiency.",
  },
  rdw: {
    what: "How much your red cells vary in size.",
    high: "A mixed population of cells. Often rises BEFORE MCV in early iron or B12 deficiency, so it is an early warning.",
    low: "Normal.",
  },
  wcc: {
    what: "Total immune cells in circulation.",
    high: "Infection, inflammation, steroids, stress, strenuous exercise.",
    low: "Viral infection, some medications, marrow problems. Can also be a harmless normal variant.",
  },
  neutrophils: {
    what: "First responders to bacterial infection.",
    high: "Bacterial infection, inflammation, steroids, hard exercise.",
    low: "Viral infection, some drugs. Well under 1.0 raises genuine infection risk.",
  },
  lymphocytes: {
    what: "Viral defence and antibody production.",
    high: "Viral infection. Persistently high can signal a blood disorder.",
    low: "Recent virus, steroids, heavy training blocks, chronic stress.",
  },
  monocytes: {
    what: "The clean-up crew that clears debris after an infection.",
    high: "Chronic infection, inflammation, or recovery from a recent illness.",
    low: "Not usually meaningful.",
  },
  eosinophils: {
    what: "Cells that respond to parasites and allergy.",
    high: "Allergy, asthma, eczema, drug reactions, parasitic infection.",
    low: "Normal. Steroids and acute infection push them down.",
    track: "The key companion to IgE — high IgE with normal eosinophils argues allergy over parasites.",
  },
  basophils: {
    what: "Allergic and inflammatory response cells.",
    high: "Rare. Chronic inflammation, some blood disorders.",
    low: "Normal.",
  },
  platelets: {
    what: "The cells that clot your blood.",
    high: "Inflammation, iron deficiency, recovery from infection. Rarely a marrow disorder.",
    low: "Viral illness, alcohol, autoimmune disease, some medications. Causes easy bruising and bleeding.",
  },
  reticulocytes: {
    what: "Brand new red cells. Shows how hard your marrow is working right now.",
    high: "Marrow responding to bleeding or haemolysis — or to iron and B12 treatment, where it is the sign it is working.",
    low: "Marrow not responding. Deficiency or a marrow problem.",
    track: "Only meaningful read next to haemoglobin.",
  },

  /* ---------------------------------------------------------------- immune */
  ige: {
    what: "The allergy antibody.",
    high: "Hay fever, asthma, eczema, food allergy — and parasitic infection. Eosinophils help separate the two.",
    low: "Normal.",
    track: "Total IgE says you are allergic, not what to. Allergen-specific IgE answers that.",
  },
};
