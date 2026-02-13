// Wing Lab — simple JS only (robust version)

document.addEventListener("DOMContentLoaded", () => {
  try {
    boot();
    console.log("[Wing Lab] app.js loaded ✅");
  } catch (err) {
    console.error("[Wing Lab] boot failed ❌", err);
    alert("Wing Lab error: open DevTools Console for details.");
  }
});

function boot() {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // --- Guard: make sure key elements exist ---
  const required = [
    "#method", "#decServings", "#incServings", "#servingsLabel",
    "#recipeTitle", "#recipeDesc", "#ingredientsList", "#stepsList",
    "#copyList", "#toggleUnits", "#resetChecks",
    "#customMin", "#startTimer", "#stopTimer", "#timerReadout",
    "#timePill", "#skillPill",
    "#progressText", "#progressBar",
    "#printRecipe",
    "#nutritionList", "#nutritionServings", "#nutritionBatch",
    "#saucePct", "#saucePctText"
  ];

  const missing = required.filter((sel) => !$(sel));
  if (missing.length) {
    console.warn("[Wing Lab] Missing elements:", missing);
    throw new Error("Missing required DOM elements: " + missing.join(", "));
  }

  const state = {
    flavorKey: "mango",
    method: "bake",     // bake | airfry
    lbs: 2,             // 1..6
    units: "US",        // US | Metric
    detailPanel: "ingredients", // ingredients | steps | timer | nutrition
    saucePct: 100,      // 0..100 (how much sauce is eaten)
    timer: { id: null, endAt: null }
  };

  // =========================
  // Nutrition (est.) — ingredient-based + sauce eaten slider
  // =========================
  // Serving assumption: 0.5 lb raw wings per serving (2 lb = 4 servings)
  // Wings nutrition uses "chicken wing, meat+skin, raw" per 100g (typical reference values).
  // Sauce nutrition uses per-tbsp common values.
  //
  // Slider scales SAUCE macros only:
  // 0% = sauce mostly left behind; 100% = all sauce eaten.

  const NUTRITION = {
    // Chicken wing, meat+skin, raw — per 100g
    wing_raw_100g: { kcal: 173, protein_g: 18.4, fat_g: 10.6 },

    // Per 1 tbsp (unless noted)
    butter_tbsp: { kcal: 102, protein_g: 0.12, fat_g: 11.5 },
    honey_tbsp: { kcal: 64, protein_g: 0.0, fat_g: 0.0 },
    mayo_tbsp: { kcal: 57, protein_g: 0.13, fat_g: 4.91 },
    soy_tbsp: { kcal: 8.48, protein_g: 1.0, fat_g: 0.01 },
    rice_vinegar_tbsp: { kcal: 3, protein_g: 0.0, fat_g: 0.0 },
    brown_sugar_tbsp: { kcal: 34, protein_g: 0.0, fat_g: 0.0 },
    mango_preserves_tbsp: { kcal: 45, protein_g: 0.0, fat_g: 0.0 },
    sweet_chili_tbsp: { kcal: 20, protein_g: 0.0, fat_g: 0.0 },
    bbq_sauce_tbsp: { kcal: 30, protein_g: 0.0, fat_g: 0.0 },
    dijon_tbsp: { kcal: 15, protein_g: 0.0, fat_g: 0.0 },
    parmesan_tbsp: { kcal: 27, protein_g: 2.405, fat_g: 1.7875 }
  };

  function servingsFromLbs(lbs) {
    return Math.max(1, Math.round(lbs * 2));
  }

  function addMacro(a, b) {
    return {
      kcal: (a.kcal || 0) + (b.kcal || 0),
      protein_g: (a.protein_g || 0) + (b.protein_g || 0),
      fat_g: (a.fat_g || 0) + (b.fat_g || 0)
    };
  }

  function mulMacro(m, factor) {
    return {
      kcal: (m.kcal || 0) * factor,
      protein_g: (m.protein_g || 0) * factor,
      fat_g: (m.fat_g || 0) * factor
    };
  }

  function wingsMacroForBatch(lbs) {
    const grams = lbs * 453.592;
    const factor = grams / 100;
    return mulMacro(NUTRITION.wing_raw_100g, factor);
  }

  function tbsp(n) { return n; }
  function tspToTbsp(nTsp) { return nTsp / 3; }
  function cupToTbsp(nCups) { return nCups * 16; }

  function sauceMacroForFlavor(flavorKey, lbs) {
    const f = lbs / 2;
    let total = { kcal: 0, protein_g: 0, fat_g: 0 };

    const addTbsp = (macroKey, nTbsp) => {
      const m = NUTRITION[macroKey];
      if (!m) return;
      total = addMacro(total, mulMacro(m, nTbsp));
    };

    switch (flavorKey) {
      case "mango":
        addTbsp("mango_preserves_tbsp", cupToTbsp(0.5) * f);
        addTbsp("soy_tbsp", tbsp(1) * f);
        addTbsp("rice_vinegar_tbsp", tbsp(1) * f);
        return total;

      case "lemonpepper":
        addTbsp("butter_tbsp", tbsp(3) * f);
        return total;

      case "buffalo":
        addTbsp("butter_tbsp", tbsp(3) * f);
        return total;

      case "garlicparm":
        addTbsp("butter_tbsp", tbsp(3) * f);
        addTbsp("parmesan_tbsp", cupToTbsp(1/3) * f);
        return total;

      case "honeygarlic":
        addTbsp("butter_tbsp", tbsp(2) * f);
        addTbsp("honey_tbsp", tbsp(3) * f);
        addTbsp("soy_tbsp", tbsp(1) * f);
        addTbsp("rice_vinegar_tbsp", tspToTbsp(1) * f);
        return total;

      case "teriyaki":
        addTbsp("soy_tbsp", tbsp(3) * f);
        addTbsp("brown_sugar_tbsp", tbsp(2) * f);
        addTbsp("rice_vinegar_tbsp", tbsp(1) * f);
        return total;

      case "cajun":
        return total;

      case "bbq":
        addTbsp("bbq_sauce_tbsp", cupToTbsp(0.5) * f);
        addTbsp("butter_tbsp", tbsp(1) * f);
        return total;

      case "honeymustard":
        addTbsp("honey_tbsp", tbsp(3) * f);
        addTbsp("dijon_tbsp", tbsp(2) * f);
        addTbsp("mayo_tbsp", tbsp(1) * f);
        addTbsp("rice_vinegar_tbsp", tspToTbsp(1) * f);
        return total;

      case "garlicbutter":
        addTbsp("butter_tbsp", tbsp(4) * f);
        return total;

      case "sweetchili":
        addTbsp("sweet_chili_tbsp", cupToTbsp(0.5) * f);
        addTbsp("soy_tbsp", tbsp(1) * f);
        return total;

      case "cajunhoney":
        addTbsp("honey_tbsp", tbsp(3) * f);
        addTbsp("butter_tbsp", tbsp(2) * f);
        addTbsp("rice_vinegar_tbsp", tspToTbsp(1) * f);
        return total;

      case "chipotlelime":
        addTbsp("butter_tbsp", tbsp(2) * f);
        return total;

      default:
        return total;
    }
  }

  function perServingFromBatch(batchMacro, servings) {
    return {
      kcal: batchMacro.kcal / servings,
      protein_g: batchMacro.protein_g / servings,
      fat_g: batchMacro.fat_g / servings
    };
  }

  function formatNumber(n){
    return Math.round(Number(n));
  }

  // --- Data (recipes) ---
  const FLAVORS = {
    mango: {
      title: "Mango Wings",
      desc: "Sweet, tangy, lightly spicy glaze.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Mango glaze"),
        item("Mango preserves or mango jam", qty(0.5, "cup", lbs, units)),
        item("Hot sauce (optional)", qty(1, "tbsp", lbs, units), "Start small, add more later."),
        item("Rice vinegar or apple cider vinegar", qty(1, "tbsp", lbs, units)),
        item("Soy sauce", qty(1, "tbsp", lbs, units)),
        item("Garlic (minced)", qty(2, "cloves", lbs, units)),
        item("Lime juice", qty(1, "tbsp", lbs, units)),
        item("Cornstarch (optional, for thicker glaze)", qty(1, "tsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Make the mango glaze: simmer mango preserves + vinegar + soy + garlic + lime for 3–5 min.", "Keep it gently bubbling, not scorching."),
        step("Optional: whisk cornstarch with 1 tbsp water, stir into glaze 30–60 sec to thicken.", "Skip if you like it thinner."),
        step("Toss hot cooked wings in glaze until coated.", "Sauce sticks best when wings are hot."),
        step("Serve immediately. Optional: top with chopped cilantro or sliced green onion.", "Crunchy garnish = big upgrade.")
      ]
    },

    lemonpepper: {
      title: "Lemon Pepper Wings",
      desc: "Bright, buttery, and super crispy.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Lemon pepper butter"),
        item("Butter", qty(3, "tbsp", lbs, units)),
        item("Lemon pepper seasoning", qty(2, "tbsp", lbs, units), "Use less if yours is salty."),
        item("Fresh lemon zest", qty(1, "tsp", lbs, units)),
        item("Fresh lemon juice", qty(1, "tbsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Melt butter in a bowl; mix in lemon pepper, zest, and lemon juice.", "Taste it. Adjust lemon pepper to your salt level."),
        step("Toss hot cooked wings in lemon pepper butter until glossy.", "Add more seasoning after tossing if you want it punchier."),
        step("Serve immediately. Optional: extra lemon wedges on the side.", "Squeeze right before eating.")
      ]
    },

    buffalo: {
      title: "Buffalo Wings",
      desc: "Classic spicy wings with buttery heat.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Buffalo sauce"),
        item("Hot sauce (Frank’s-style)", qty(0.5, "cup", lbs, units)),
        item("Butter", qty(3, "tbsp", lbs, units)),
        item("Garlic powder (optional)", qty(0.5, "tsp", lbs, units)),
        item("Honey (optional)", qty(1, "tsp", lbs, units), "Adds balance; skip if you want pure heat.")
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Warm hot sauce + butter in a small pot 1–2 min (don’t boil hard).", "Whisk until smooth."),
        step("Optional: whisk in garlic powder and honey.", "Taste and adjust."),
        step("Toss wings in sauce. Serve with celery + ranch/blue cheese if you like.", "Classic combo.")
      ]
    },

    garlicparm: {
      title: "Garlic Parmesan Wings",
      desc: "Savory, cheesy, garlicky — crowd favorite.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Garlic parm butter"),
        item("Butter", qty(3, "tbsp", lbs, units)),
        item("Garlic (minced)", qty(3, "cloves", lbs, units)),
        item("Parmesan (finely grated)", qty(0.33, "cup", lbs, units)),
        item("Parsley (chopped, optional)", qty(1, "tbsp", lbs, units)),
        item("Black pepper", qty(0.5, "tsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Gently sauté garlic in butter 1–2 min (low heat).", "Don’t brown it; bitter garlic is sad garlic."),
        step("Turn off heat. Stir in parmesan, pepper, and parsley.", "Sauce will thicken as it cools."),
        step("Toss hot wings in garlic parm mixture until coated.", "Add extra parmesan on top if you want.")
      ]
    },

    honeygarlic: {
      title: "Honey Garlic Wings",
      desc: "Sticky-sweet honey, lots of garlic, and a savory finish.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Honey garlic sauce"),
        item("Butter", qty(2, "tbsp", lbs, units)),
        item("Garlic (minced)", qty(4, "cloves", lbs, units)),
        item("Honey", qty(3, "tbsp", lbs, units)),
        item("Soy sauce", qty(1, "tbsp", lbs, units)),
        item("Rice vinegar or apple cider vinegar", qty(1, "tsp", lbs, units)),
        item("Red pepper flakes (optional)", qty(0.5, "tsp", lbs, units)),
        item("Cornstarch (optional, for thicker sauce)", qty(1, "tsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Make honey garlic sauce: melt butter on low, add garlic 30–60 sec (don’t brown).", "Low heat keeps garlic sweet."),
        step("Stir in honey, soy sauce, and vinegar; simmer 2–3 min.", "Gentle simmer = glossy sauce."),
        step("Optional: whisk cornstarch with 1 tbsp water, stir in 30–60 sec to thicken.", "Thick sauce clings better."),
        step("Toss hot wings in sauce until coated.", "Sauce sticks best when wings are hot."),
        step("Optional: add red pepper flakes for heat.", "Start small; it ramps fast.")
      ]
    },

    teriyaki: {
      title: "Teriyaki Wings",
      desc: "Sweet-savory glaze with ginger and soy. Great with sesame.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Teriyaki glaze"),
        item("Soy sauce", qty(3, "tbsp", lbs, units)),
        item("Brown sugar (or honey)", qty(2, "tbsp", lbs, units)),
        item("Rice vinegar", qty(1, "tbsp", lbs, units)),
        item("Sesame oil (optional)", qty(1, "tsp", lbs, units)),
        item("Ginger (grated or powder)", qty(1, "tsp", lbs, units)),
        item("Garlic (minced)", qty(2, "cloves", lbs, units)),
        item("Cornstarch", qty(2, "tsp", lbs, units)),
        item("Sesame seeds + sliced green onion (optional garnish)", "to taste", "Totally worth it.")
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Make the glaze: whisk soy sauce, sugar, vinegar, ginger, garlic, sesame oil (optional).", "Taste it: more sweet or more tangy as you like."),
        step("Simmer 2–3 min, then add cornstarch mixed with 2 tbsp water.", "Stir until thick and shiny (30–60 sec)."),
        step("Toss hot wings in teriyaki glaze until coated.", "Work quickly—glaze sets as it cools."),
        step("Optional: garnish with sesame seeds + green onion.", "Adds crunch + freshness.")
      ]
    },

    bbq: {
      title: "BBQ Wings",
      desc: "Smoky, sweet, classic BBQ glaze.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("BBQ glaze"),
        item("BBQ sauce", qty(0.5, "cup", lbs, units)),
        item("Butter (optional)", qty(1, "tbsp", lbs, units), "Makes it glossy."),
        item("Apple cider vinegar (optional)", qty(1, "tsp", lbs, units), "Brightens heavy sauces."),
        item("Hot sauce or cayenne (optional)", qty(1, "tsp", lbs, units), "For a kick.")
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Warm BBQ sauce (and butter if using) 2–3 min on low.", "Don’t boil hard—sauce can scorch."),
        step("Optional: stir in vinegar + heat (hot sauce/cayenne).", "Taste and adjust."),
        step("Toss hot wings in BBQ glaze until coated.", "Sauce sticks best when wings are hot."),
        step("Optional: return wings to oven/air fryer 2–4 min to set glaze.", "Helps it cling and caramelize lightly.")
      ]
    },

    honeymustard: {
      title: "Honey Mustard Wings",
      desc: "Sweet, tangy, and super easy.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Honey mustard sauce"),
        item("Honey", qty(3, "tbsp", lbs, units)),
        item("Dijon mustard", qty(2, "tbsp", lbs, units)),
        item("Mayo (optional)", qty(1, "tbsp", lbs, units), "Creamier, like a dip-style coating."),
        item("Apple cider vinegar or lemon juice", qty(1, "tsp", lbs, units)),
        item("Black pepper", qty(0.25, "tsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Whisk honey + Dijon + vinegar (and mayo if using).", "Taste: more honey for sweet, more Dijon for sharp."),
        step("Toss hot wings in sauce until coated.", "Coats best while wings are hot."),
        step("Optional: sprinkle a pinch more pepper on top.", "Simple but nice.")
      ]
    },

    garlicbutter: {
      title: "Garlic Butter Wings",
      desc: "Buttery, garlicky, and ridiculously good.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Garlic butter"),
        item("Butter", qty(4, "tbsp", lbs, units)),
        item("Garlic (minced)", qty(4, "cloves", lbs, units)),
        item("Parsley (optional)", qty(1, "tbsp", lbs, units)),
        item("Lemon juice (optional)", qty(1, "tsp", lbs, units), "Brightens the butter.")
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Melt butter on low. Add garlic 30–60 sec (don’t brown).", "Low heat keeps garlic sweet."),
        step("Turn off heat; stir in parsley + lemon juice (optional).", "Lemon makes it pop."),
        step("Toss hot wings in garlic butter until glossy.", "Serve right away.")
      ]
    },

    sweetchili: {
      title: "Sweet Chili Wings",
      desc: "Sticky-sweet with a gentle heat (Thai-style vibe).",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Sweet chili glaze"),
        item("Sweet chili sauce", qty(0.5, "cup", lbs, units)),
        item("Soy sauce", qty(1, "tbsp", lbs, units)),
        item("Lime juice", qty(1, "tbsp", lbs, units)),
        item("Garlic (minced)", qty(2, "cloves", lbs, units)),
        item("Cornstarch (optional)", qty(1, "tsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Simmer sweet chili sauce + soy + garlic 2–3 min.", "Keep it gentle."),
        step("Optional: whisk cornstarch with 1 tbsp water, stir 30–60 sec to thicken.", "Thicker = clingier."),
        step("Turn off heat; stir in lime juice.", "Add citrus off-heat to keep it bright."),
        step("Toss hot wings in glaze until coated.", "Optional: garnish with sesame seeds.")
      ]
    },

    cajunhoney: {
      title: "Cajun Honey Wings",
      desc: "Sweet heat: Cajun spice + honey glaze.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Cajun honey glaze"),
        item("Honey", qty(3, "tbsp", lbs, units)),
        item("Butter", qty(2, "tbsp", lbs, units)),
        item("Cajun seasoning", qty(2, "tsp", lbs, units), "Use less if salty."),
        item("Apple cider vinegar or lemon juice", qty(1, "tsp", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Warm honey + butter 1–2 min on low until loose.", "Low heat so honey doesn’t burn."),
        step("Stir in Cajun seasoning + vinegar/lemon.", "Taste and adjust heat."),
        step("Toss hot wings in Cajun honey glaze until coated.", "Optional: dust a pinch more Cajun on top.")
      ]
    },

    chipotlelime: {
      title: "Chipotle Lime Wings",
      desc: "Smoky chipotle with bright lime — bold and zesty.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        ...baseWingIngredients(lbs, units),
        section("Chipotle lime sauce"),
        item("Butter", qty(2, "tbsp", lbs, units)),
        item("Chipotle powder (or smoked paprika + cayenne)", qty(2, "tsp", lbs, units), "Adjust for heat."),
        item("Honey (optional)", qty(1, "tbsp", lbs, units), "Balances smoke + spice."),
        item("Lime juice", qty(1, "tbsp", lbs, units)),
        item("Garlic (minced)", qty(2, "cloves", lbs, units))
      ],
      steps: (method) => [
        ...baseWingSteps(method),
        step("Melt butter on low; stir in chipotle powder and garlic 30–60 sec.", "Low heat; spices bloom fast."),
        step("Turn off heat; stir in lime juice (and honey if using).", "Citrus off-heat keeps it bright."),
        step("Toss hot wings until coated.", "Optional: finish with extra lime zest.")
      ]
    },

    cajun: {
      title: "Cajun Dry Rub Wings",
      desc: "Bold, smoky, spicy dry rub — crispy and mess-free.",
      timeBake: "~45–55 min",
      timeAir: "~22–28 min",
      skill: "Beginner-friendly",
      ingredients: (lbs, units) => [
        section("Base wings (Cajun style)"),
        item("Chicken wings", lbsToUnits(lbs, units)),
        item("Baking powder (oven method)", qty(1, "tbsp", lbs, units)),
        item("Kosher salt", qty(1, "tsp", lbs, units)),
        section("Cajun dry rub"),
        item("Paprika", qty(2, "tsp", lbs, units)),
        item("Garlic powder", qty(1, "tsp", lbs, units)),
        item("Onion powder", qty(1, "tsp", lbs, units)),
        item("Cayenne pepper", qty(0.5, "tsp", lbs, units), "Use less for mild."),
        item("Dried oregano", qty(0.5, "tsp", lbs, units)),
        item("Dried thyme", qty(0.5, "tsp", lbs, units)),
        item("Black pepper", qty(0.5, "tsp", lbs, units)),
        item("Brown sugar (optional)", qty(1, "tsp", lbs, units), "Adds balance and browning.")
      ],
      steps: (method) => {
        const air = [
          step("Pat wings very dry with paper towels.", "Dry skin = crisp wings."),
          step("Mix Cajun rub ingredients in a bowl.", "It should smell bold, smoky, peppery."),
          step("Toss wings with salt + Cajun rub (skip baking powder in many air fryers).", "If you do use it, use less to avoid chalky taste."),
          step("Air fry at 380°F for 12 min, flip, 10–14 min more.", "Optional: finish 2–4 min at 400°F for extra crisp."),
          step("Check doneness: 165°F minimum at the thickest part.", "Bigger wings need more time."),
          step("Serve as-is, or add a squeeze of lemon to brighten.", "Acid makes spices pop.")
        ];

        const oven = [
          step("Pat wings very dry with paper towels.", "Dry skin = crisp wings."),
          step("Mix Cajun rub ingredients + baking powder in a bowl.", "Baking powder boosts crispness in the oven."),
          step("Toss wings with Cajun rub mixture until evenly coated.", "Even dusting = even flavor."),
          step("Bake at 425°F on a rack: 20 min, flip, 20 min.", "Add 5–10 min if you want more crisp."),
          step("Check doneness: 165°F minimum (175–185°F is extra tender/crispy).", "Higher temps can be nicer for wings."),
          step("Serve as-is, or add a squeeze of lemon to brighten.", "Acid makes spices pop.")
        ];

        return method === "airfry" ? air : oven;
      }
    }
  };

  // --- Base ingredients + steps (shared) ---
  function baseWingIngredients(lbs, units) {
    return [
      section("Base wings"),
      item("Chicken wings", lbsToUnits(lbs, units)),
      item("Baking powder (NOT baking soda)", qty(1, "tbsp", lbs, units), "Helps crisp the skin (oven method)."),
      item("Kosher salt", qty(1, "tsp", lbs, units)),
      item("Black pepper", qty(0.5, "tsp", lbs, units)),
      item("Garlic powder", qty(0.75, "tsp", lbs, units)),
      item("Paprika (optional)", qty(0.5, "tsp", lbs, units))
    ];
  }

  function baseWingSteps(method) {
    const bake = [
      step("Pat wings very dry with paper towels.", "Dry skin = crisp wings."),
      step("Toss wings with baking powder, salt, pepper, garlic powder (and paprika if using).", "Baking powder is the crispy helper."),
      step("Heat oven to 425°F. Place wings on a rack over a sheet pan.", "Airflow matters. If no rack, spread on foil and flip more often."),
      step("Bake 20 min, flip, bake 20 min.", "If they’re not crisp, add 5–10 min more."),
      step("Check doneness: thickest part should hit 165°F.", "For crispier texture, 175–185°F is great.")
    ];

    const airfry = [
      step("Pat wings very dry with paper towels.", "Dry skin = crisp wings."),
      step("Toss wings with salt, pepper, garlic powder (skip baking powder in many air fryers).", "If you do use it, use less; it can taste chalky."),
      step("Preheat air fryer to 380°F (if your model supports preheat).", "Preheat helps browning."),
      step("Air fry 12 min, flip, 10–14 min more at 380°F.", "If you want extra crisp, finish 2–4 min at 400°F."),
      step("Check doneness: thickest part should hit 165°F.", "Bigger wings may need a few extra minutes.")
    ];

    return method === "airfry" ? airfry : bake;
  }

  // --- Helpers ---
  function section(label){ return { kind: "section", label }; }
  function item(name, amount, note){ return { kind: "item", name, amount, note: note || "" }; }
  function step(text, note){ return { text, note: note || "" }; }
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function qty(baseAmount, unit, lbs, units){
    const factor = lbs / 2;
    const scaled = baseAmount * factor;
    const rounded = roundSmart(scaled);

    if (units === "Metric"){
      if (unit === "tbsp") return `${toMl(rounded * 15)} mL`;
      if (unit === "tsp") return `${toMl(rounded * 5)} mL`;
      if (unit === "cup") return `${toMl(rounded * 240)} mL`;
    }
    return `${rounded} ${unit}`;
  }

  function lbsToUnits(lbs, units){
    if (units === "Metric"){
      const grams = Math.round(lbs * 453.592);
      return `${grams} g`;
    }
    return `${lbs} lb`;
  }

  function toMl(v){ return Math.round(Number(v)); }

  function roundSmart(n){
    const num = Number(n);
    if (num <= 2) return (Math.round(num * 4) / 4).toString();
    return (Math.round(num * 2) / 2).toString();
  }

  // --- progress ---
  function updateProgress(){
    const total = document.querySelectorAll("#stepsList input[type='checkbox']").length;
    const done = document.querySelectorAll("#stepsList input[type='checkbox']:checked").length;
    $("#progressText").textContent = `${done}/${total}`;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#progressBar").style.width = `${pct}%`;
    $("#progressBar").setAttribute("aria-valuenow", String(pct));
  }

  // --- detail tabs ---
  function setDetailPanel(panelKey){
    state.detailPanel = panelKey;

    $$(".detail-tab").forEach(btn => {
      const active = btn.dataset.panel === panelKey;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    $$(".detail-panel").forEach(panel => {
      const active = panel.dataset.panel === panelKey;
      panel.classList.toggle("active", active);
    });
  }

  // --- nutrition rendering ---
  function renderNutrition(){
    const servings = servingsFromLbs(state.lbs);

    const wingsBatch = wingsMacroForBatch(state.lbs);
    const sauceBatchFull = sauceMacroForFlavor(state.flavorKey, state.lbs);
    const sauceFactor = clamp(state.saucePct, 0, 100) / 100;
    const sauceBatchEaten = mulMacro(sauceBatchFull, sauceFactor);

    const batch = addMacro(wingsBatch, sauceBatchEaten);
    const per = perServingFromBatch(batch, servings);

    $("#nutritionServings").textContent = String(servings);
    $("#nutritionBatch").textContent = state.units === "Metric"
      ? `${Math.round(state.lbs * 453.592)} g`
      : `${state.lbs} lb`;

    $("#saucePctText").textContent = String(state.saucePct);

    const items = [
      { label: "Calories", value: `${formatNumber(per.kcal)} kcal` },
      { label: "Protein", value: `${formatNumber(per.protein_g)} g` },
      { label: "Fat", value: `${formatNumber(per.fat_g)} g` }
    ];

    const ul = $("#nutritionList");
    ul.innerHTML = "";
    items.forEach(x => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(x.label)}:</strong> ${escapeHtml(x.value)} <span class="hint small">(per serving)</span>`;
      ul.appendChild(li);
    });
  }

  // --- UI Rendering ---
  function render(){
    const flavor = FLAVORS[state.flavorKey];

    $("#recipeTitle").textContent = flavor.title;
    $("#recipeDesc").textContent = flavor.desc;

    const timeText = state.method === "airfry" ? flavor.timeAir : flavor.timeBake;
    $("#timePill").textContent = `⏱ ${timeText}`;
    $("#skillPill").textContent = `🧠 ${flavor.skill}`;

    $("#servingsLabel").textContent = state.units === "Metric"
      ? `${Math.round(state.lbs * 453.592)} g`
      : `${state.lbs} lb`;

    // Ingredients
    const ing = flavor.ingredients(state.lbs, state.units);
    const ul = $("#ingredientsList");
    ul.innerHTML = "";
    ing.forEach((x) => {
      const li = document.createElement("li");
      if (x.kind === "section"){
        li.className = "ingredient-section";
        li.innerHTML = `<strong>${escapeHtml(x.label)}</strong>`;
      } else {
        const note = x.note ? ` <span class="hint small">(${escapeHtml(x.note)})</span>` : "";
        li.innerHTML = `<strong>${escapeHtml(x.amount)}</strong> — ${escapeHtml(x.name)}${note}`;
      }
      ul.appendChild(li);
    });

    // Steps with checkboxes
    const key = checksKey();
    const saved = loadChecks(key);

    const steps = flavor.steps(state.method);
    const ol = $("#stepsList");
    ol.innerHTML = "";
    steps.forEach((s, idx) => {
      const li = document.createElement("li");
      const checked = saved[idx] === true;

      li.innerHTML = `
        <div class="step-line">
          <input class="step-check" type="checkbox" data-step="${idx}" ${checked ? "checked" : ""} aria-label="Mark step ${idx+1} complete" />
          <div>
            <div class="step-text">${escapeHtml(s.text)}</div>
            ${s.note ? `<span class="step-note">${escapeHtml(s.note)}</span>` : ""}
          </div>
        </div>
      `;
      ol.appendChild(li);
    });

    // Flavor tabs
    $$(".tab").forEach(btn => {
      const active = btn.dataset.flavor === state.flavorKey;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    // Units
    $("#toggleUnits").textContent = `Units: ${state.units === "US" ? "US" : "Metric"}`;
    $("#toggleUnits").setAttribute("aria-pressed", state.units === "Metric" ? "true" : "false");

    renderNutrition();
    updateProgress();
  }

  function checksKey(){
    return `checks::${state.flavorKey}::${state.method}::${state.lbs}::${state.units}`;
  }

  function loadChecks(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    }catch{
      return {};
    }
  }

  function saveCheck(idx, value){
    const key = checksKey();
    const saved = loadChecks(key);
    saved[idx] = value;
    localStorage.setItem(key, JSON.stringify(saved));
  }

  function resetChecks(){
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("checks::")) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Reset failed (localStorage blocked?)", e);
    }

    render();
    toast("Checks reset ✅");
    updateProgress();
  }

  // --- Shopping list copy ---
  async function copyShoppingList(){
    const flavor = FLAVORS[state.flavorKey];
    const ing = flavor.ingredients(state.lbs, state.units);

    const lines = [];
    lines.push(`Wing Lab — ${flavor.title}`);
    lines.push(`Method: ${state.method === "airfry" ? "Air Fryer" : "Oven"}`);
    lines.push(`Batch: ${state.units === "Metric" ? `${Math.round(state.lbs*453.592)} g` : `${state.lbs} lb`}`);
    lines.push("");

    ing.forEach(x => {
      if (x.kind === "section") lines.push(`— ${x.label} —`);
      else lines.push(`${x.amount}  ${x.name}`);
    });

    const text = lines.join("\n");

    try{
      await navigator.clipboard.writeText(text);
      toast("Copied shopping list ✅");
    }catch{
      toast("Clipboard blocked — try running a local server.");
      console.warn("Clipboard write failed; run via a local server for best results.");
    }
  }

  // --- Timer ---
  function startTimer(minutes){
    stopTimer();
    const ms = minutes * 60 * 1000;
    state.timer.endAt = Date.now() + ms;

    state.timer.id = setInterval(() => {
      const left = state.timer.endAt - Date.now();
      if (left <= 0){
        stopTimer();
        $("#timerReadout").textContent = "Timer done! ✅ Check your wings.";
        beep();
        return;
      }
      $("#timerReadout").textContent = `Time left: ${formatMs(left)}`;
    }, 250);

    $("#timerReadout").textContent = `Time left: ${formatMs(ms)}`;
  }

  function stopTimer(){
    if (state.timer.id) clearInterval(state.timer.id);
    state.timer.id = null;
    state.timer.endAt = null;
  }

  function formatMs(ms){
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  function beep(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.06;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 180);
    }catch{}
  }

  // --- Print ---
  function printRecipe(){
    const prev = state.detailPanel;
    document.body.classList.add("printing");
    $$(".detail-panel").forEach(p => p.classList.add("active"));

    try { document.title = `Wing Lab — ${FLAVORS[state.flavorKey].title}`; } catch {}

    window.print();

    window.setTimeout(() => {
      document.body.classList.remove("printing");
      setDetailPanel(prev);
    }, 200);
  }

  // --- Tiny toast ---
  let toastEl = null;
  function toast(msg){
    if (!toastEl){
      toastEl = document.createElement("div");
      toastEl.style.position = "fixed";
      toastEl.style.left = "50%";
      toastEl.style.bottom = "18px";
      toastEl.style.transform = "translateX(-50%)";
      toastEl.style.padding = "10px 12px";
      toastEl.style.borderRadius = "999px";
      toastEl.style.background = "rgba(8,12,18,0.88)";
      toastEl.style.border = "1px solid rgba(34,48,70,0.9)";
      toastEl.style.color = "#e8eef7";
      toastEl.style.fontWeight = "700";
      toastEl.style.zIndex = "9999";
      toastEl.style.boxShadow = "0 12px 22px rgba(0,0,0,0.35)";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.style.opacity = "0", 1300);
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // --- Events ---
  $("#method").addEventListener("change", (e) => {
    state.method = e.target.value;
    render();
  });

  $("#decServings").addEventListener("click", () => {
    state.lbs = clamp(state.lbs - 1, 1, 6);
    render();
  });

  $("#incServings").addEventListener("click", () => {
    state.lbs = clamp(state.lbs + 1, 1, 6);
    render();
  });

  // Flavor tabs
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.flavor;
      if (!FLAVORS[key]) {
        console.warn("Unknown flavor key:", key);
        return;
      }
      state.flavorKey = key;
      render();
    });
  });

  // Detail tabs
  $$(".detail-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const panelKey = btn.dataset.panel;
      setDetailPanel(panelKey);
    });
  });

  // Steps checks
  $("#stepsList").addEventListener("change", (e) => {
    const cb = e.target.closest("input[type='checkbox']");
    if (!cb) return;
    const idx = Number(cb.dataset.step);
    saveCheck(idx, cb.checked);
    updateProgress();
  });

  // Reset
  $("#resetChecks").addEventListener("click", (e) => {
    e.preventDefault();
    console.log("[Wing Lab] Reset checks clicked");
    resetChecks();
  }, { passive: false });

  // Copy list
  $("#copyList").addEventListener("click", copyShoppingList);

  // Units
  $("#toggleUnits").addEventListener("click", () => {
    state.units = state.units === "US" ? "Metric" : "US";
    render();
  });

  // Timer presets
  $$(".preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const min = Number(btn.dataset.min);
      startTimer(min);
      toast(`Timer started: ${min} minutes`);
    });
  });

  $("#startTimer").addEventListener("click", () => {
    const min = Number($("#customMin").value);
    if (!min || min < 1 || min > 120){
      toast("Enter 1–120 minutes");
      return;
    }
    startTimer(min);
    toast(`Timer started: ${min} minutes`);
  });

  $("#stopTimer").addEventListener("click", () => {
    stopTimer();
    $("#timerReadout").textContent = "No timer running.";
    toast("Timer stopped");
  });

  // Print
  $("#printRecipe").addEventListener("click", (e) => {
    e.preventDefault();
    printRecipe();
  });

  // Sauce slider (updates nutrition live)
  const sauceEl = $("#saucePct");
  sauceEl.value = String(state.saucePct);
  $("#saucePctText").textContent = String(state.saucePct);

  sauceEl.addEventListener("input", () => {
    state.saucePct = Number(sauceEl.value);
    renderNutrition();
  });

  // initial state
  setDetailPanel(state.detailPanel);
  render();
}
