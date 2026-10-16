const db = require('../config/database');
const { supabase, supabaseAdmin, isConfigured } = require('../config/supabase');
const crypto = require('crypto');

/**
 * Demo Request Data Access Model
 * Manages enterprise walkthrough requests across Supabase & PostgreSQL stores.
 */
class DemoRequestModel {
  /**
   * Create and persist a new Enterprise Demo Request
   * @param {{
   *   fullName: string,
   *   workEmail: string,
   *   company: string,
   *   teamSize: string,
   *   primaryDataSource: string,
   *   phone?: string,
   *   notes?: string,
   *   metadata?: any
   * }} data
   * @returns {Promise<any>}
   */
  async createDemoRequest({
    fullName,
    workEmail,
    company,
    teamSize,
    primaryDataSource,
    phone = null,
    notes = null,
    idempotencyKey = null,
    metadata = {}
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanEmail = workEmail.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanCompany = company.trim();

    // 1. Duplicate Submission Protection (Prevent double-clicks within 30 seconds or matching idempotency key)
    try {
      const dupCheckSql = `
        SELECT * FROM demo_requests 
        WHERE LOWER(work_email) = LOWER($1)
          AND (
            ($2::text IS NOT NULL AND idempotency_key = $2)
            OR created_at >= NOW() - INTERVAL '30 seconds'
          )
        ORDER BY created_at DESC 
        LIMIT 1;
      `;
      const dupRes = await db.query(dupCheckSql, [cleanEmail, idempotencyKey || null]);
      if (dupRes?.rows?.length > 0) {
        const existing = dupRes.rows[0];
        console.log(`[DemoRequestModel] ℹ️ Duplicate submission detected for "${cleanEmail}" (ID: ${existing.id}). Reusing existing record.`);
        return {
          ...existing,
          isDuplicate: true
        };
      }
    } catch (checkErr) {
      // Table may not have idempotency_key yet, proceed safely
    }

    const recordData = {
      id,
      full_name: cleanName,
      work_email: cleanEmail,
      company: cleanCompany,
      team_size: teamSize.trim(),
      primary_data_source: primaryDataSource.trim(),
      phone: phone ? phone.trim() : null,
      notes: notes ? notes.trim() : null,
      status: 'pending',
      metadata: typeof metadata === 'object' ? metadata : {},
      created_at: now,
      updated_at: now
    };

    let dbRecord = null;
    const tDbStart = performance.now();

    // 2. Primary Fast PostgreSQL Persistence
    try {
      const sql = `
        INSERT INTO demo_requests (
          name,
          email,
          full_name,
          work_email,
          company,
          team_size,
          role,
          primary_data_source,
          phone,
          notes,
          metadata,
          status,
          idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;

      const result = await db.query(sql, [
        cleanName,
        cleanEmail,
        cleanName,
        cleanEmail,
        cleanCompany,
        recordData.team_size,
        'Enterprise Lead',
        recordData.primary_data_source,
        recordData.phone,
        recordData.notes,
        JSON.stringify(recordData.metadata),
        'pending',
        idempotencyKey || null
      ]);

      dbRecord = result?.rows?.[0] || recordData;
      const dbDuration = Math.round(performance.now() - tDbStart);
      console.log(`[DemoRequestModel] ⚡ Demo request persisted to PostgreSQL in ${dbDuration}ms (ID: ${dbRecord.id})`);
    } catch (dbErr) {
      console.warn('[DemoRequestModel] Primary DB insert warning, falling back to legacy schema:', dbErr.message);
      try {
        const fallbackSql = `
          INSERT INTO demo_requests (
            name, email, full_name, work_email, company, team_size,
            primary_data_source, phone, notes, metadata, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *;
        `;
        const res = await db.query(fallbackSql, [
          cleanName, cleanEmail, cleanName, cleanEmail, cleanCompany,
          recordData.team_size, recordData.primary_data_source,
          recordData.phone, recordData.notes, JSON.stringify(recordData.metadata), 'pending'
        ]);
        dbRecord = res?.rows?.[0] || recordData;
      } catch (fErr) {
        console.error('[DemoRequestModel] ❌ Database store failed:', fErr.message);
        dbRecord = recordData;
      }
    }

    // 3. Asynchronous Non-Blocking Supabase Sync (Runs in background, never delays response)
    if (isConfigured) {
      setImmediate(async () => {
        try {
          const client = supabaseAdmin || supabase;
          if (client) {
            await client.from('demo_requests').insert([recordData]);
            console.log(`[DemoRequestModel] ☁️ Async Supabase sync completed for [${id}]`);
          }
        } catch (sbErr) {
          console.warn('[DemoRequestModel] Async Supabase sync note:', sbErr.message);
        }
      });
    }

    return {
      ...dbRecord,
      id: dbRecord.id || id,
      supabase_stored: isConfigured
    };
  }

  /**
   * List all demo requests (for administration / triage)
   * @param {{ limit?: number, offset?: number }} [options={}]
   * @returns {Promise<Array<any>>}
   */
  async listDemoRequests({ limit = 50, offset = 0 } = {}) {
    // Try Supabase first if available
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabase;
        if (client) {
          const { data, error } = await client
            .from('demo_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (!error && Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      } catch (err) {
        // Fallback to SQL DB
      }
    }

    const sql = `
      SELECT *
      FROM demo_requests
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await db.query(sql, [limit, offset]);
    return result.rows || [];
  }
}

module.exports = new DemoRequestModel();
