/**
 * Lightweight In-Memory Observability Metrics Collector
 * Tracks process metrics, HTTP requests, error counts, latencies, and subsystem health.
 */
class MetricsCollector {
  constructor() {
    this.startTime = Date.now();
    this.requests = {
      total: 0,
      status2xx: 0,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0
    };
    this.latencies = []; // rolling bounded sample for p50/p95/p99
    this.maxLatencySamples = 1000;
    this.subsystemCounts = {
      aiQueries: 0,
      aiFailures: 0,
      exports: 0,
      exportFailures: 0,
      reportExecutions: 0,
      reportFailures: 0,
      databaseErrors: 0,
      rateLimitHits: 0,
      authFailures: 0
    };
    this.activeConnections = 0;
  }

  recordRequest(statusCode, durationMs) {
    this.requests.total++;
    if (statusCode >= 200 && statusCode < 300) this.requests.status2xx++;
    else if (statusCode >= 300 && statusCode < 400) this.requests.status3xx++;
    else if (statusCode >= 400 && statusCode < 500) this.requests.status4xx++;
    else if (statusCode >= 500) this.requests.status5xx++;

    if (typeof durationMs === 'number' && durationMs >= 0) {
      if (this.latencies.length >= this.maxLatencySamples) {
        this.latencies.shift();
      }
      this.latencies.push(durationMs);
    }
  }

  recordSubsystem(type, success = true) {
    if (type === 'ai') {
      this.subsystemCounts.aiQueries++;
      if (!success) this.subsystemCounts.aiFailures++;
    } else if (type === 'export') {
      this.subsystemCounts.exports++;
      if (!success) this.subsystemCounts.exportFailures++;
    } else if (type === 'report') {
      this.subsystemCounts.reportExecutions++;
      if (!success) this.subsystemCounts.reportFailures++;
    } else if (type === 'database') {
      if (!success) this.subsystemCounts.databaseErrors++;
    } else if (type === 'rate_limit') {
      this.subsystemCounts.rateLimitHits++;
    } else if (type === 'auth') {
      if (!success) this.subsystemCounts.authFailures++;
    }
  }

  getPercentiles() {
    if (this.latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = parseFloat((sum / sorted.length).toFixed(2));
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1] || 0;

    return {
      avg,
      p50: parseFloat(p50.toFixed(2)),
      p95: parseFloat(p95.toFixed(2)),
      p99: parseFloat(p99.toFixed(2)),
      sampleCount: sorted.length
    };
  }

  getSnapshot() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();

    return {
      status: 'healthy',
      uptime_seconds: uptimeSec,
      timestamp: new Date().toISOString(),
      requests: {
        ...this.requests,
        error_rate_pct: this.requests.total > 0
          ? parseFloat(((this.requests.status5xx / this.requests.total) * 100).toFixed(2))
          : 0
      },
      latency_ms: this.getPercentiles(),
      subsystems: { ...this.subsystemCounts },
      memory: {
        rss_mb: parseFloat((mem.rss / (1024 * 1024)).toFixed(2)),
        heap_used_mb: parseFloat((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        heap_total_mb: parseFloat((mem.heapTotal / (1024 * 1024)).toFixed(2))
      }
    };
  }

  reset() {
    this.requests = { total: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 };
    this.latencies = [];
    Object.keys(this.subsystemCounts).forEach(k => { this.subsystemCounts[k] = 0; });
  }
}

module.exports = new MetricsCollector();
