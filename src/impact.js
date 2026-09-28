// Impact numbers shown on the "Client" and "Quality" screens.
//
// RULE: never invent a number. Leave a value as null until it comes from a real
// source (helpdesk export, team estimate, BigQuery); null renders as [FILL].
// Client-facing times are in MINUTES (e.g. 2 days = 2880).
// After editing: `npx wrangler deploy`.

export const IMPACT = {
  // Team estimates of hours saved per week, per department (no longer shown:
  // the "Pain removed" screen replaced the hours screen on Sep 28).
  sectors: [
    { sector: "SEO", hoursPerWeek: null, drivers: ["Query Fan-Out", "Recipe Card AI"] },
    { sector: "Content", hoursPerWeek: null, drivers: ["AI Writer", "Brand Profiles"] },
    { sector: "Web/WordPress", hoursPerWeek: null, drivers: ["AI Dev"] },
    { sector: "Digital PR", hoursPerWeek: null, drivers: ["Digital PR Tracking"] },
    { sector: "Link Building", hoursPerWeek: null, drivers: ["Backlink Gaps"] },
    { sector: "Local/GBP", hoursPerWeek: null, drivers: ["GBP Monitor", "Review Removal"] },
    { sector: "Paid Media", hoursPerWeek: null, drivers: ["Executive Summary"] },
    { sector: "Account Management", hoursPerWeek: null, drivers: ["Executive Summary", "Slack AI Assistant"] },
  ],

  // Client email volume shared by the team on Sep 28, 2026 (period not stated yet).
  volume: { emails: 66823, inbound: 33743, period: null },

  // Before → after, in minutes. "live" = measured by the stage stopwatch.
  client: [
    // Zendesk medians shared by the team on Sep 28, 2026 (current period). "before" still needed.
    { id: "response", sub: "Client requests · median", label: "Time to first reply", before: null, after: 10 },
    { id: "ticket", sub: "Tickets · median · first resolution 5.1 h", label: "Full resolution time", before: null, after: 768 },
    { id: "aidev", sub: "AI Dev", label: "Small site change live on staging", before: null, after: "live" },
    { id: "writer", sub: "AI Writer", label: "Client-ready content draft", before: null, after: null },
  ],

  // Quality Shield. Metrics are either {label, before, after} or {label, value}.
  quality: [
    {
      name: "AI Writer Final QA + brand-compliance check",
      prevents: "Off-brand or incomplete drafts reaching the client",
      metrics: [
        { label: "Drafts approved on first review", before: null, after: null },
        { label: "Revision rounds per piece", before: null, after: null },
      ],
    },
    {
      name: "Required-field validation before any AI step",
      prevents: "Content generated with missing legal or client data",
      metrics: [{ label: "Drafts blocked before generation", value: null }],
    },
    {
      name: "Second AI agent QA-checks Recipe Cards",
      prevents: "Wrong on-page recommendations",
      metrics: [{ label: "Issues caught before a strategist sees them", value: null }],
    },
    {
      name: "AI noise filter on the GBP monitor",
      prevents: "Alert fatigue; real changes getting missed",
      metrics: [{ label: "Alerts sent per 100 changes detected", value: null }],
    },
    {
      name: "Lead data from BigQuery, validated side by side",
      prevents: "Clients seeing wrong lead numbers",
      metrics: [{ label: "Discrepancies found and fixed", value: null }],
    },
    {
      name: "Watchdogs + failed-crawl + workflow-error reports",
      prevents: "Jobs silently stuck for days",
      metrics: [{ label: "Median time a stuck job goes unnoticed", before: null, after: null }],
    },
    {
      // Source: Blin's HenneHuddle deck, Sep 1–27 and the Sep 25–27 SEO QA weekend.
      name: "AI DEV tests every change in a real browser",
      prevents: "Broken or unverified changes reaching clients",
      metrics: [
        { label: "Screenshots of evidence, Sept 1–27", value: "22,823" },
        { label: "SEO QA weekend: findings fixed of 1,321 found", value: "681" },
      ],
    },
    {
      name: "Legacy random-number charts → real data",
      prevents: "Decisions made on fake numbers",
      metrics: [{ label: "Of those charts now use real data", value: "100%" }],
    },
  ],
};
