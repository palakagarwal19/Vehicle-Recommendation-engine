let countries = []

const countrySelect = document.getElementById("country")
const resultsContainer = document.getElementById("recommendations")
const resultsSection = document.getElementById("results")
const form = document.getElementById("criteria-form")


/* =========================
   LOAD COUNTRIES
========================= */

async function loadCountries() {

  try {

    const response = await api.getCountries()

    if (!Array.isArray(response) || response.length === 0)
      throw new Error("Invalid country list")

    const nameMap = {
      US: "United States",
      DE: "Germany",
      FR: "France",
      UK: "United Kingdom",
      CN: "China",
      JP: "Japan",
      IN: "India",
      CA: "Canada",
      AU: "Australia",
      BR: "Brazil"
    }

    countries = response.map(code => ({
      code,
      name: nameMap[code] || code
    }))

    countrySelect.innerHTML = countries
      .map(c => `<option value="${c.code}">${c.name}</option>`)
      .join("")

    countrySelect.value = "US"

  } catch (error) {

    countrySelect.innerHTML = `
      <option value="US">United States</option>
      <option value="DE">Germany</option>
      <option value="FR">France</option>
      <option value="UK">United Kingdom</option>
    `
  }
}


/* =========================
   GET RECOMMENDATIONS
========================= */

async function getRecommendations(criteria) {

  const dailyKm = criteria.annualKm / 365
  const years = 10

  const response = await api.getRecommendations(
    dailyKm,
    years,
    { powertrain: criteria.powertrain || null },
    criteria.country,
    2023
  )

  if (!Array.isArray(response)) throw new Error("Invalid API response")

  return response.slice(0, 3).map((rec, i) => {

    const score = calculateScore(rec.total_g_per_km)

    return {
      vehicle: rec,
      ranking: i + 1,
      score: Math.round(score),
      scoreClass:
        score > 70 ? "excellent" :
        score > 50 ? "good" : "moderate",
      reasons: generateReasons(rec)
    }
  })
}


/* =========================
   REASON GENERATION
========================= */

function generateReasons(v) {

  const reasons = []

  if (v.powertrain === "EV")
    reasons.push("Zero tailpipe emissions")

  if (v.total_g_per_km < 100)
    reasons.push("Excellent lifecycle efficiency")

  if (v.operational_g_per_km < 50)
    reasons.push("Low operational emissions")

  if (v.manufacturing_g_per_km < 50)
    reasons.push("Low manufacturing footprint")

  if (v.powertrain === "HEV")
    reasons.push("Hybrid fuel efficiency")

  if (v.powertrain === "PHEV")
    reasons.push("Electric + hybrid flexibility")

  return reasons.length ? reasons : ["Lower emissions than alternatives"]
}


/* =========================
   SCORE CALCULATION
========================= */

function calculateScore(total) {

  return Math.max(0, Math.min(100, 100 - total / 3))
}


/* =========================
   RENDER RESULTS
========================= */

function renderRecommendations(list) {

  if (!list.length) {

    resultsContainer.innerHTML =
      `<div class="text-center">No vehicles match your criteria</div>`

    resultsSection.style.display = "block"
    return
  }

  resultsContainer.innerHTML = list.map(rec => {

    const v = rec.vehicle

    return `
      <div class="recommendation-card rank-${rec.ranking}">
        <div class="flex-between mb-sm">
          <h4>#${rec.ranking} ${v.vehicle}</h4>
          <span class="score score-${rec.scoreClass}">
            ${rec.score}/100
          </span>
        </div>

        <p>
          <span class="badge badge-${(v.powertrain || "").toLowerCase()}">
            ${v.powertrain}
          </span>
        </p>

        <p><strong>Total:</strong> ${formatEmission(v.total_g_per_km)} g/km</p>
        <p><strong>Manufacturing:</strong> ${formatEmission(v.manufacturing_g_per_km)} g/km</p>
        <p><strong>Operational:</strong> ${formatEmission(v.operational_g_per_km)} g/km</p>

        <ul class="reasoning">
          ${rec.reasons.map(r => `<li>${r}</li>`).join("")}
        </ul>
      </div>
    `
  }).join("")

  resultsSection.style.display = "block"
}


/* =========================
   FORM SUBMIT
========================= */

form.addEventListener("submit", async e => {

  e.preventDefault()

  resultsContainer.innerHTML =
    `<div class="skeleton skeleton-card"></div>`.repeat(3)

  resultsSection.style.display = "block"

  const criteria = {
    country: countrySelect.value,
    annualKm: parseInt(document.getElementById("annual-km").value),
    powertrain: document.getElementById("powertrain").value
  }

  try {

    const recs = await getRecommendations(criteria)

    renderRecommendations(recs)

  } catch (err) {

    resultsContainer.innerHTML =
      `<div class="text-center">Recommendation service unavailable</div>`
  }
})


/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {

  loadCountries()

})