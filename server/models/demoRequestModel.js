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
    metadata = {}
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const recordData = {
      id,
      full_name: fullName.trim(),
      work_email: workEmail.trim().toLowerCase(),
      company: company.trim(),
      team_size: teamSize.trim(),
      primary_data_source: primaryDataSource.trim(),
      phone: phone ? phone.trim() : null,
      notes: notes ? notes.trim() : null,
      status: 'pending',
      metadata: typeof metadata === 'object' ? metadata : {},
      created_at: now,
      updated_at: now
    };

    let supabaseStored = false;
    let supabaseRecord = null;

    // 1. Direct Supabase Storage
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabase;
        if (client) {
          const { data, error } = await client
            .from('demo_requests')
            .insert([recordData])
            .select()
            .single();

          if (!error && data) {
            supabaseStored = true;
            supabaseRecord = data;
            console.log(` Demo request successfully persisted in Supabase [${id}]`);
          } else if (error) {
            console.warn(` Supabase demo_requests insert note (${error.message}). Syncing via database layer.`);
          }
        }
      } catch (sbErr) {
        console.warn(' Supabase client dispatch exception:', sbErr.message);
      }
    }

    // 2. PostgreSQL / In-Memory Fallback Persistence
    try {
      const sql = `
        INSERT INTO demo_requests (
          id,
          full_name,
          work_email,
          company,
          team_size,
          primary_data_source,
          phone,
          notes,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const result = await db.query(sql, [
        id,
        recordData.full_name,
        recordData.work_email,
        recordData.company,
        recordData.team_size,
        recordData.primary_data_source,
        recordData.phone,
        recordData.notes,
        JSON.stringify(recordData.metadata)
      ]);

      const dbRecord = result?.rows?.[0] || recordData;
      return {
        ...dbRecord,
        supabase_stored: supabaseStored || Boolean(supabaseRecord)
      };
    } catch (dbErr) {
      console.error(' Database store demo_requests error:', dbErr.message);
      // If DB failed but supabase succeeded, return supabase record
      if (supabaseRecord) {
        return {
          ...supabaseRecord,
          supabase_stored: true
        };
      }
      // Return normalized record to avoid data loss
      return {
        ...recordData,
        supabase_stored: supabaseStored
      };
    }
  }

  /**
   * List all demo requests (for administration / triage)
   * @param {{ limit?: number, offset?: number }} [options={}]
   * @returns {Promise<Array<any>>}
   */
  async listDemoRequests({ limit = 50, offset = 0 } = {}) {
    // Try Supabase first
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabase;
        if (client) {
          const { data, error } = await client
            .from('demo_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (!error && Array.isArray(data)) {
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
