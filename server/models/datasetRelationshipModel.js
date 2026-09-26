const db = require('../config/database');
const crypto = require('crypto');

/**
 * Dataset Relationship Data Access Model
 * Multi-tenant relational schema mapping between datasets
 */
const DatasetRelationshipModel = {
  /**
   * Create a new dataset relationship
   * @param {{
   *   organizationId: string,
   *   createdBy?: number|string|null,
   *   sourceDatasetId: number|string,
   *   sourceColumn: string,
   *   targetDatasetId: number|string,
   *   targetColumn: string,
   *   relationshipType?: 'one_to_one'|'one_to_many'|'many_to_one'|'many_to_many',
   *   description?: string
   * }} data
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    createdBy = null,
    sourceDatasetId,
    sourceColumn,
    targetDatasetId,
    targetColumn,
    relationshipType = 'many_to_one',
    description = ''
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO dataset_relationships (
        id,
        organization_id,
        created_by,
        source_dataset_id,
        source_column,
        target_dataset_id,
        target_column,
        relationship_type,
        description,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      organizationId,
      createdBy ? Number(createdBy) : null,
      Number(sourceDatasetId),
      sourceColumn.trim(),
      Number(targetDatasetId),
      targetColumn.trim(),
      relationshipType.toLowerCase(),
      description || ''
    ]);

    return result.rows[0];
  },

  /**
   * Find all relationships for an organization with joined dataset metadata
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        r.id,
        r.organization_id,
        r.created_by,
        r.source_dataset_id,
        r.source_column,
        r.target_dataset_id,
        r.target_column,
        r.relationship_type,
        r.description,
        r.created_at,
        r.updated_at,
        sd.name AS source_dataset_name,
        sd.file_path AS source_file_path,
        td.name AS target_dataset_name,
        td.file_path AS target_file_path,
        u.name AS creator_name,
        u.email AS creator_email
      FROM dataset_relationships r
      LEFT JOIN datasets sd ON sd.id = r.source_dataset_id
      LEFT JOIN datasets td ON td.id = r.target_dataset_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.organization_id = $1
      ORDER BY r.created_at DESC;
    `;

    const result = await db.query(sql, [organizationId]);
    return result.rows || [];
  },

  /**
   * Find single relationship by ID and organization ID
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        r.id,
        r.organization_id,
        r.created_by,
        r.source_dataset_id,
        r.source_column,
        r.target_dataset_id,
        r.target_column,
        r.relationship_type,
        r.description,
        r.created_at,
        r.updated_at,
        sd.name AS source_dataset_name,
        sd.file_path AS source_file_path,
        td.name AS target_dataset_name,
        td.file_path AS target_file_path
      FROM dataset_relationships r
      LEFT JOIN datasets sd ON sd.id = r.source_dataset_id
      LEFT JOIN datasets td ON td.id = r.target_dataset_id
      WHERE r.id = $1 AND r.organization_id = $2
      LIMIT 1;
    `;

    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Find direct relationships between specific datasets
   * @param {number|string} datasetA 
   * @param {number|string} datasetB 
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findBetweenDatasets(datasetA, datasetB, organizationId) {
    const sql = `
      SELECT *
      FROM dataset_relationships
      WHERE organization_id = $3
        AND (
          (source_dataset_id = $1 AND target_dataset_id = $2)
          OR (source_dataset_id = $2 AND target_dataset_id = $1)
        );
    `;

    const result = await db.query(sql, [Number(datasetA), Number(datasetB), organizationId]);
    return result.rows || [];
  },

  /**
   * Update an existing dataset relationship
   * @param {string} id 
   * @param {string} organizationId 
   * @param {{
   *   sourceColumn?: string,
   *   targetColumn?: string,
   *   relationshipType?: string,
   *   description?: string
   * }} data
   * @returns {Promise<any | null>}
   */
  async update(id, organizationId, {
    sourceColumn,
    targetColumn,
    relationshipType,
    description
  }) {
    const updates = [];
    const params = [id, organizationId];
    let paramIndex = 3;

    if (sourceColumn !== undefined) {
      updates.push(`source_column = $${paramIndex++}`);
      params.push(sourceColumn.trim());
    }

    if (targetColumn !== undefined) {
      updates.push(`target_column = $${paramIndex++}`);
      params.push(targetColumn.trim());
    }

    if (relationshipType !== undefined) {
      updates.push(`relationship_type = $${paramIndex++}`);
      params.push(relationshipType.toLowerCase());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE dataset_relationships
      SET ${updates.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;

    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  /**
   * Delete a dataset relationship
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async delete(id, organizationId) {
    const sql = `
      DELETE FROM dataset_relationships
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;

    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  }
};

module.exports = DatasetRelationshipModel;
