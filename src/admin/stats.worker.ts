type Visit = { visited_at: string; device_type?: string | null; visitor_id: string };
type Result = { completed_at: string; score: number };

self.onmessage = (event: MessageEvent<{ visits: Visit[]; results: Result[]; days: number }>) => {
  const { visits, results, days } = event.data;
  const dayMap = new Map<string, { visits: number; visitors: Set<string> }>();
  const deviceMap = new Map<string, number>();
  const now = new Date();

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, { visits: 0, visitors: new Set() });
  }

  visits.forEach((visit) => {
    const key = visit.visited_at.slice(0, 10);
    const row = dayMap.get(key);
    if (row) {
      row.visits++;
      row.visitors.add(visit.visitor_id);
    }
    const device = visit.device_type || '기타';
    deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
  });

  const averageScore = results.length
    ? Math.round(results.reduce((sum, result) => sum + Number(result.score || 0), 0) / results.length)
    : 0;

  postMessage({
    daily: [...dayMap.entries()].map(([date, value]) => ({
      date,
      visits: value.visits,
      visitors: value.visitors.size
    })),
    devices: [...deviceMap.entries()].map(([name, value]) => ({ name, value })),
    averageScore
  });
};
