const config = require('../config');

/**
 * Node.js ML Service Connector
 * Bridges Express backend with the Python FastAPI Time-Series & Anomaly Detection Service.
 */
class MLForecastService {
  constructor() {
    this.baseUrl = config.mlServiceUrl || 'http://127.0.0.1:8000';
    this.timeoutMs = 8000;
  }

  /**
   * Check FastAPI ML microservice connectivity
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/ml/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
      return { success: false, status: 'offline' };
    } catch {
      return { success: false, status: 'offline' };
    }
  }

  /**
   * Standardize parameter inputs
   */
  _normalizeForecastParams(dataOrParams, options = {}) {
    if (Array.isArray(dataOrParams)) {
      return {
        data: dataOrParams,
        horizon: options.horizon ?? options.horizon_periods ?? 30,
        model_name: options.model ?? options.model_name ?? 'linear_regression',
        interval: options.interval ?? 'daily',
        date_col: options.date_col ?? options.dateColumn ?? 'date',
        value_col: options.value_col ?? options.targetColumn ?? 'value',
        confidence_level: options.confidence_level ?? options.confidenceLevel ?? 0.95,
        z_threshold: options.z_threshold ?? options.zThreshold ?? 2.5
      };
    }
    const p = dataOrParams || {};
    return {
      data: p.data || p.series || [],
      horizon: p.horizon ?? p.horizon_periods ?? 30,
      model_name: p.model ?? p.model_name ?? 'linear_regression',
      interval: p.interval ?? 'daily',
      date_col: p.date_col ?? p.dateColumn ?? 'date',
      value_col: p.value_col ?? p.targetColumn ?? 'value',
      confidence_level: p.confidence_level ?? p.confidenceLevel ?? 0.95,
      z_threshold: p.z_threshold ?? p.zThreshold ?? 2.5
    };
  }

  /**
   * Request ML time-series forecast from Python FastAPI service
   */
  async generateForecast(dataOrParams, options = {}) {
    const params = this._normalizeForecastParams(dataOrParams, options);
    const { data, horizon, model_name, interval, date_col, value_col, confidence_level } = params;

    if (!data || !Array.isArray(data) || data.length < 3) {
      throw new Error('Insufficient historical data points. At least 3 observations are required for forecasting.');
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/ml/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          horizon: parseInt(horizon, 10),
          model_name,
          interval,
          date_col,
          value_col,
          confidence_level: parseFloat(confidence_level)
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (response.ok) {
        const result = await response.json();
        return {
          ...result,
          engine: 'python_fastapi_ml'
        };
      }

      if (response.status === 400) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Invalid forecasting parameters');
      }
    } catch (err) {
      if (err.message && err.message.includes('Insufficient')) {
        throw err;
      }
      console.warn(`[ML Service Notice] Python ML service unreachable (${err.message}). Using native statistical engine.`);
    }

    // High-precision Node.js statistical fallback engine
    return this._statisticalFallbackForecast(data, horizon, interval, confidence_level, model_name);
  }

  /**
   * Request statistical anomaly detection on time-series observations
   */
  async detectAnomalies(dataOrParams, options = {}) {
    let data, date_col, value_col, window_size, threshold;
    if (Array.isArray(dataOrParams)) {
      data = dataOrParams;
      date_col = options.date_col || 'date';
      value_col = options.value_col || 'value';
      window_size = options.windowSize || options.window_size || 5;
      threshold = options.zThreshold || options.threshold || options.z_threshold || 2.5;
    } else {
      const p = dataOrParams || {};
      data = p.data || p.series || [];
      date_col = p.date_col || 'date';
      value_col = p.value_col || 'value';
      window_size = p.window_size || p.windowSize || 5;
      threshold = p.threshold || p.zThreshold || p.z_threshold || 2.5;
    }

    if (!data || !Array.isArray(data) || data.length < 3) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/ml/anomalies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          date_col,
          value_col,
          window_size: parseInt(window_size, 10),
          threshold: parseFloat(threshold)
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (response.ok) {
        const resJson = await response.json();
        return resJson.anomalies || [];
      }
    } catch (err) {
      console.warn(`[ML Service Notice] Anomaly detection fallback engaged: ${err.message}`);
    }

    return this._statisticalFallbackAnomalies(data, threshold, window_size, date_col, value_col);
  }

  /**
   * Combined Forecasting and Anomaly Detection pipeline
   */
  async forecastAndDetect(dataOrParams, options = {}) {
    const params = this._normalizeForecastParams(dataOrParams, options);
    const forecast = await this.generateForecast(params);
    const anomalies = await this.detectAnomalies(params.data, {
      date_col: params.date_col,
      value_col: params.value_col,
      z_threshold: params.z_threshold
    });

    return {
      ...forecast,
      anomalies: anomalies || [],
      anomaly_count: (anomalies || []).length
    };
  }

  // ==========================================================================
  // High-Precision Statistical Fallback Engines
  // ==========================================================================

  _statisticalFallbackForecast(data, horizon = 30, interval = 'daily', confidenceLevel = 0.95, modelName = 'linear_regression') {
    const values = data.map(d => parseFloat(d.value !== undefined ? d.value : d.val)).filter(v => !isNaN(v));
    const dates = data.map(d => String(d.date || d.timestamp || d.time));
    const n = values.length;

    if (n < 3) {
      throw new Error('Insufficient historical data for forecasting.');
    }

    // Fit Ordinary Least Squares
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const beta = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
    const alpha = (sumY - beta * sumX) / n;

    // Residual variance
    let ssRes = 0;
    let ssTot = 0;
    let maeSum = 0;
    let mapeSum = 0;
    const meanY = sumY / n;

    for (let i = 0; i < n; i++) {
      const yHat = alpha + beta * i;
      const diff = values[i] - yHat;
      ssRes += diff * diff;
      ssTot += (values[i] - meanY) * (values[i] - meanY);
      maeSum += Math.abs(diff);
      if (values[i] !== 0) {
        mapeSum += Math.abs(diff / values[i]);
      }
    }

    const sErr = Math.sqrt(ssRes / Math.max(1, n - 2)) || Math.max(1, Math.abs(meanY) * 0.05);
    const zCrit = confidenceLevel >= 0.98 ? 2.576 : (confidenceLevel <= 0.92 ? 1.645 : 1.96);

    const futureDates = this._generateFutureDates(dates[dates.length - 1], horizon, interval);
    const predictions = [];
    const xMean = sumX / n;
    const xSS = sumX2 - n * Math.pow(xMean, 2) || 1;

    for (let h = 0; h < horizon; h++) {
      const xFuture = n + h;
      const pred = alpha + beta * xFuture;
      const sePred = sErr * Math.sqrt(1 + (1 / n) + Math.pow(xFuture - xMean, 2) / xSS);
      const margin = zCrit * sePred;

      const pVal = Math.round(pred * 100) / 100;
      const lVal = Math.round((pred - margin) * 100) / 100;
      const uVal = Math.round((pred + margin) * 100) / 100;

      predictions.push({
        date: futureDates[h],
        predicted: pVal,
        lower_bound: lVal,
        upper_bound: uVal
      });
    }

    const r2 = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 1;
    const mae = maeSum / n;
    const rmse = Math.sqrt(ssRes / n);
    const mape = (mapeSum / n) * 100;

    return {
      success: true,
      model: modelName === 'auto' ? 'linear_regression' : modelName,
      historical_points: n,
      forecast_points: horizon,
      predictions,
      confidence_intervals: {
        [String(Math.round(confidenceLevel * 100))]: predictions.map(p => ({
          date: p.date,
          lower: p.lower_bound,
          upper: p.upper_bound
        }))
      },
      metrics: {
        mae: Number(mae.toFixed(4)),
        rmse: Number(rmse.toFixed(4)),
        mape: Number(mape.toFixed(2)),
        r2: Number(r2.toFixed(4))
      },
      model_metadata: {
        engine: 'node_statistical_fallback',
        alpha: Number(alpha.toFixed(4)),
        beta: Number(beta.toFixed(4)),
        confidence_level: confidenceLevel
      }
    };
  }

  _statisticalFallbackAnomalies(data, threshold = 2.5, windowSize = 5, dateCol = 'date', valueCol = 'value') {
    const records = data.map(d => ({
      date: String(d[dateCol] || d.date || d.timestamp || d.time),
      val: parseFloat(d[valueCol] !== undefined ? d[valueCol] : d.value)
    })).filter(r => !isNaN(r.val));

    const n = records.length;
    if (n < 3) return [];

    const vals = records.map(r => r.val);
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / Math.max(1, n - 1);
    const globalStd = Math.sqrt(variance) || 1.0;

    const anomalies = [];

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(n, i + windowSize + 1);
      const windowVals = vals.slice(start, end).filter((_, idx) => idx !== (i - start));
      const effectiveVals = windowVals.length >= 2 ? windowVals : vals;

      const wMean = effectiveVals.reduce((a, b) => a + b, 0) / effectiveVals.length;
      const wVar = effectiveVals.reduce((s, v) => s + Math.pow(v - wMean, 2), 0) / Math.max(1, effectiveVals.length - 1);
      const std = Math.sqrt(wVar) || globalStd;

      const actual = records[i].val;
      const zScore = Math.abs(actual - wMean) / std;

      if (zScore >= threshold) {
        const deviation = actual - wMean;
        let severity = 'low';
        if (zScore >= 4.0 || Math.abs(deviation) > globalStd * 4) severity = 'critical';
        else if (zScore >= 3.0) severity = 'high';
        else if (zScore >= 2.0) severity = 'medium';

        anomalies.push({
          timestamp: records[i].date,
          actual_value: Number(actual.toFixed(2)),
          expected_value: Number(wMean.toFixed(2)),
          deviation: Number(deviation.toFixed(2)),
          anomaly_score: Number(zScore.toFixed(3)),
          severity,
          direction: actual > wMean ? 'spike' : 'dip'
        });
      }
    }

    return anomalies;
  }

  _generateFutureDates(lastDateStr, horizon, interval) {
    const dates = [];
    const baseDate = lastDateStr ? new Date(lastDateStr) : new Date();
    if (isNaN(baseDate.getTime())) {
      const now = new Date();
      for (let i = 1; i <= horizon; i++) {
        dates.push(new Date(now.getTime() + i * 86400000).toISOString().split('T')[0]);
      }
      return dates;
    }

    for (let i = 1; i <= horizon; i++) {
      const nextDate = new Date(baseDate);
      switch (interval) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + (i * 7));
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + i);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + (i * 3));
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + i);
          break;
        case 'hourly':
          nextDate.setHours(nextDate.getHours() + i);
          break;
        case 'daily':
        default:
          nextDate.setDate(nextDate.getDate() + i);
          break;
      }
      dates.push(nextDate.toISOString().split('T')[0]);
    }

    return dates;
  }
}

module.exports = new MLForecastService();
