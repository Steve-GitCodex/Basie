function secsUntil(endsAt) {
  return Math.ceil((endsAt - Date.now()) / 1000);
}

function buildJob(bm) {
  const job = bm.getBuildQueue().find(row => row.isActive && secsUntil(row.endsAt) > 0);
  return job && { label: `Building ${job.cfg?.name ?? job.buildingId}`, secsLeft: secsUntil(job.endsAt) };
}

function trainJob(um) {
  const job = um.getAllQueues().find(row => row.queueIndex === 0 && row.endsAt && secsUntil(row.endsAt) > 0);
  return job && { label: `Training ${job.name ?? job.unitId}`, secsLeft: secsUntil(job.endsAt) };
}

function researchJob(tech) {
  const job = tech.getQueue().find(row => row.isActive && row.researchEndsAt && secsUntil(row.researchEndsAt) > 0);
  return job && { label: `Researching ${job.name}`, secsLeft: secsUntil(job.researchEndsAt) };
}

/** Keyed by speed-up target: 'building' | 'training' | 'research'; null when nothing is running. */
export function getActiveQueues({ bm, um, tech }) {
  return {
    building: bm ? buildJob(bm) ?? null : null,
    training: um ? trainJob(um) ?? null : null,
    research: tech ? researchJob(tech) ?? null : null,
  };
}
