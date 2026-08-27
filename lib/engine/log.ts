export function slog(event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    svc: 'gatezero',
    event,
    ...fields
  });
  if (fields.level === 'error') console.error(line);
  else console.log(line);
}
