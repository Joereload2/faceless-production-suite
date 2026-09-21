export type LogLevel = "info" | "error";

export function log(fields: {
  level: LogLevel;
  event: string;
  jobId?: string;
  projectId?: string;
  module?: string;
  errorCode?: string;
  extra?: string;
  ms?: number;
  owner?: string;
}): void {
  const line: Record<string, unknown> = {
    level: fields.level,
    ts: new Date().toISOString(),
    event: fields.event,
  };
  if (fields.jobId) line.jobId = fields.jobId;
  if (fields.projectId) line.projectId = fields.projectId;
  if (fields.module) line.module = fields.module;
  if (fields.errorCode) line.errorCode = fields.errorCode;
  if (fields.extra) line.extra = fields.extra;
  if (fields.ms !== undefined) line.ms = fields.ms;
  if (fields.owner) line.owner = fields.owner;
  const sink = fields.level === "error" ? console.error : console.log;
  sink(JSON.stringify(line));
}
