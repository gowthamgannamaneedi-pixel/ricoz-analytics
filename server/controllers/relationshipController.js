const DatasetRelationshipModel = require('../models/datasetRelationshipModel');
const Dataset = require('../models/datasetModel');
const analyticsService = require('../services/analyticsService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

/**
 * Dataset Relationships & Relational Data Modeling Controller
 */
const relationshipController = {
  /**
   * GET /api/dataset-relationships
   * List all defined dataset relationships in the organization
   */
  async getRelationships(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const relationships = await DatasetRelationshipModel.findByOrganizationId(organizationId);

      return res.status(200).json({
        success: true,
        count: relationships.length,
        data: relationships,
        relationships
      });
    } catch (err) {
      console.error('[RelationshipController.getRelationships] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve dataset relationships.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/dataset-relationships/:id
   * Retrieve a single relationship definition by ID
   */
  async getRelationshipById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const relationship = await DatasetRelationshipModel.findByIdAndOrgId(id, organizationId);
      if (!relationship) {
        return res.status(404).json({
          success: false,
          message: 'Dataset relationship not found or access denied.'
        });
      }

      return res.status(200).json({
        success: true,
        data: relationship,
        relationship
      });
    } catch (err) {
      console.error('[RelationshipController.getRelationshipById] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve relationship details.',
        error: err.message
      });
    }
  },

  /**
   * POST /api/dataset-relationships
   * Create and validate a new dataset relationship
   */
  async createRelationship(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const {
        source_dataset_id,
        sourceDatasetId,
        source_column,
        sourceColumn,
        target_dataset_id,
        targetDatasetId,
        target_column,
        targetColumn,
        relationship_type,
        relationshipType = 'many_to_one',
        description = ''
      } = req.body;

      const srcId = source_dataset_id || sourceDatasetId;
      const srcCol = source_column || sourceColumn;
      const tgtId = target_dataset_id || targetDatasetId;
      const tgtCol = target_column || targetColumn;
      const relType = relationship_type || relationshipType || 'many_to_one';

      // 1. Basic validation
      if (!srcId || !srcCol || !tgtId || !tgtCol) {
        return res.status(400).json({
          success: false,
          message: 'source_dataset_id, source_column, target_dataset_id, and target_column are required.'
        });
      }

      if (String(srcId) === String(tgtId) && String(srcCol).trim().toLowerCase() === String(tgtCol).trim().toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot link a dataset to itself on the exact same column.'
        });
      }

      // 2. Multi-Tenant Dataset Ownership & Existence Checks
      const [sourceDataset, targetDataset] = await Promise.all([
        Dataset.findByIdAndOrgId(srcId, organizationId),
        Dataset.findByIdAndOrgId(tgtId, organizationId)
      ]);

      if (!sourceDataset) {
        return res.status(404).json({
          success: false,
          message: `Source dataset (ID: ${srcId}) not found or you do not have permission to access it.`
        });
      }

      if (!targetDataset) {
        return res.status(404).json({
          success: false,
          message: `Target dataset (ID: ${tgtId}) not found or you do not have permission to access it.`
        });
      }

      // 3. Schema & Column Type Compatibility Validation
      const validation = analyticsService.validateRelationshipDefinition(
        sourceDataset,
        srcCol,
        targetDataset,
        tgtCol,
        relType
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // 4. Duplicate Check
      const existingRels = await DatasetRelationshipModel.findByOrganizationId(organizationId);
      const duplicate = existingRels.find(r => 
        String(r.source_dataset_id) === String(srcId) &&
        r.source_column.toLowerCase() === srcCol.trim().toLowerCase() &&
        String(r.target_dataset_id) === String(tgtId) &&
        r.target_column.toLowerCase() === tgtCol.trim().toLowerCase()
      );

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `A relationship between "${sourceDataset.name}.${srcCol}" and "${targetDataset.name}.${tgtCol}" already exists.`
        });
      }

      // 5. Create Record
      const newRelationship = await DatasetRelationshipModel.create({
        organizationId,
        createdBy: userId,
        sourceDatasetId: srcId,
        sourceColumn: srcCol,
        targetDatasetId: tgtId,
        targetColumn: tgtCol,
        relationshipType: relType,
        description
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.DATASET_RELATIONSHIP_CREATED,
        resourceType: 'relationship',
        resourceId: newRelationship.id,
        description: `Created ${relType} relationship: "${sourceDataset.name}.${srcCol}" -> "${targetDataset.name}.${tgtCol}"`,
        metadata: {
          sourceDataset: sourceDataset.name,
          sourceColumn: srcCol,
          targetDataset: targetDataset.name,
          targetColumn: tgtCol,
          relationshipType: relType
        },
        req
      });

      return res.status(201).json({
        success: true,
        message: 'Dataset relationship created successfully.',
        data: newRelationship,
        relationship: newRelationship
      });
    } catch (err) {
      console.error('[RelationshipController.createRelationship] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create dataset relationship.',
        error: err.message
      });
    }
  },

  /**
   * PUT /api/dataset-relationships/:id
   * Update relationship definition
   */
  async updateRelationship(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const {
        source_column,
        sourceColumn,
        target_column,
        targetColumn,
        relationship_type,
        relationshipType,
        description
      } = req.body;

      const existing = await DatasetRelationshipModel.findByIdAndOrgId(id, organizationId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Dataset relationship not found or access denied.'
        });
      }

      const srcCol = source_column || sourceColumn || existing.source_column;
      const tgtCol = target_column || targetColumn || existing.target_column;
      const relType = relationship_type || relationshipType || existing.relationship_type;

      // Validate columns if modified
      const [sourceDataset, targetDataset] = await Promise.all([
        Dataset.findByIdAndOrgId(existing.source_dataset_id, organizationId),
        Dataset.findByIdAndOrgId(existing.target_dataset_id, organizationId)
      ]);

      if (sourceDataset && targetDataset) {
        const validation = analyticsService.validateRelationshipDefinition(
          sourceDataset,
          srcCol,
          targetDataset,
          tgtCol,
          relType
        );
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error
          });
        }
      }

      const updated = await DatasetRelationshipModel.update(id, organizationId, {
        sourceColumn: srcCol,
        targetColumn: tgtCol,
        relationshipType: relType,
        description: description !== undefined ? description : existing.description
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.DATASET_RELATIONSHIP_UPDATED,
        resourceType: 'relationship',
        resourceId: id,
        description: `Updated dataset relationship (ID: ${id})`,
        metadata: { sourceColumn: srcCol, targetColumn: tgtCol, relationshipType: relType },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Dataset relationship updated successfully.',
        data: updated,
        relationship: updated
      });
    } catch (err) {
      console.error('[RelationshipController.updateRelationship] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update dataset relationship.',
        error: err.message
      });
    }
  },

  /**
   * DELETE /api/dataset-relationships/:id
   * Delete a dataset relationship definition
   */
  async deleteRelationship(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const existing = await DatasetRelationshipModel.findByIdAndOrgId(id, organizationId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Dataset relationship not found or already deleted.'
        });
      }

      const deleted = await DatasetRelationshipModel.delete(id, organizationId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Dataset relationship could not be deleted.'
        });
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.DATASET_RELATIONSHIP_DELETED,
        resourceType: 'relationship',
        resourceId: id,
        description: `Deleted dataset relationship between source (ID: ${existing.source_dataset_id}) and target (ID: ${existing.target_dataset_id})`,
        metadata: { relationshipId: id },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Dataset relationship deleted successfully.'
      });
    } catch (err) {
      console.error('[RelationshipController.deleteRelationship] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete dataset relationship.',
        error: err.message
      });
    }
  },

  /**
   * POST /api/analytics/relational-query
   * POST /api/dataset-relationships/query
   * Execute multi-dataset relational query with hash joins & aggregation
   */
  async executeRelationalQuery(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const {
        base_dataset_id,
        baseDatasetId,
        joins = [],
        dimensions = [],
        metrics = [],
        filters = {},
        limit = 5000,
        page = 1
      } = req.body;

      const effectiveBaseId = base_dataset_id || baseDatasetId;
      if (!effectiveBaseId) {
        return res.status(400).json({
          success: false,
          message: 'base_dataset_id is required to execute relational queries.'
        });
      }

      // Security: Block any arbitrary raw SQL injection payloads in parameters
      const checkArbitrarySql = (obj) => {
        const str = JSON.stringify(obj || '').toLowerCase();
        const forbidden = ['select ', 'drop table', 'delete from', 'insert into', 'update ', 'union all', '--', ';'];
        for (const f of forbidden) {
          if (str.includes(f)) {
            return true;
          }
        }
        return false;
      };

      if (checkArbitrarySql(dimensions) || checkArbitrarySql(metrics)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters: Arbitrary SQL expressions are strictly prohibited.'
        });
      }

      // 1. Verify Base Dataset
      const baseDataset = await Dataset.findByIdAndOrgId(effectiveBaseId, organizationId);
      if (!baseDataset) {
        return res.status(404).json({
          success: false,
          message: 'Base dataset not found or access denied.'
        });
      }

      let baseRecords = [];
      if (baseDataset.file_path) {
        baseRecords = await analyticsService.loadDatasetRecords(baseDataset.file_path).catch(() => []);
      }

      // 2. Resolve and verify Joins
      const populatedJoins = [];
      const configuredRelationships = await DatasetRelationshipModel.findByOrganizationId(organizationId);

      for (const j of joins) {
        const tgtDatasetId = j.dataset_id || j.datasetId || j.target_dataset_id || j.targetDatasetId;
        const srcCol = j.source_column || j.sourceColumn;
        const tgtCol = j.target_column || j.targetColumn;
        const joinType = j.type || j.join_type || 'left';

        if (!tgtDatasetId) {
          return res.status(400).json({
            success: false,
            message: 'Each join must specify a valid target dataset_id.'
          });
        }

        const targetDataset = await Dataset.findByIdAndOrgId(tgtDatasetId, organizationId);
        if (!targetDataset) {
          return res.status(404).json({
            success: false,
            message: `Target dataset (ID: ${tgtDatasetId}) not found or access denied.`
          });
        }

        // Match against configured relationship or validate explicit columns
        let effectiveSrcCol = srcCol;
        let effectiveTgtCol = tgtCol;

        if (!effectiveSrcCol || !effectiveTgtCol) {
          const matchedRel = configuredRelationships.find(r => 
            (String(r.source_dataset_id) === String(effectiveBaseId) && String(r.target_dataset_id) === String(tgtDatasetId)) ||
            (String(r.source_dataset_id) === String(tgtDatasetId) && String(r.target_dataset_id) === String(effectiveBaseId))
          );

          if (matchedRel) {
            if (String(matchedRel.source_dataset_id) === String(effectiveBaseId)) {
              effectiveSrcCol = matchedRel.source_column;
              effectiveTgtCol = matchedRel.target_column;
            } else {
              effectiveSrcCol = matchedRel.target_column;
              effectiveTgtCol = matchedRel.source_column;
            }
          }
        }

        if (!effectiveSrcCol || !effectiveTgtCol) {
          return res.status(400).json({
            success: false,
            message: `No defined relationship or join columns found between "${baseDataset.name}" and "${targetDataset.name}".`
          });
        }

        let targetRecords = [];
        if (targetDataset.file_path) {
          targetRecords = await analyticsService.loadDatasetRecords(targetDataset.file_path).catch(() => []);
        }

        populatedJoins.push({
          targetDataset,
          targetRecords,
          sourceColumn: effectiveSrcCol,
          targetColumn: effectiveTgtCol,
          type: joinType
        });
      }

      // 3. Normalize dimensions and metrics specifications
      const normalizedDimensions = Array.isArray(dimensions) ? dimensions : (dimensions ? [dimensions] : []);
      const normalizedMetrics = Array.isArray(metrics) ? metrics.map(m => {
        if (typeof m === 'string') {
          // Parse "SUM(revenue)" or "revenue"
          const match = m.match(/^([A-Za-z]+)\((.*)\)$/);
          if (match) {
            return { column: match[2].trim(), aggregation: match[1].toUpperCase(), alias: m };
          }
          return { column: m.trim(), aggregation: 'SUM', alias: m };
        }
        return m;
      }) : [];

      // 4. Execute Relational Query
      const queryResult = await analyticsService.executeRelationalQuery({
        baseDataset,
        baseRecords,
        joins: populatedJoins,
        dimensions: normalizedDimensions,
        metrics: normalizedMetrics,
        filters,
        limit,
        page
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.RELATIONAL_QUERY_EXECUTED,
        resourceType: 'relational_query',
        resourceId: effectiveBaseId,
        description: `Executed relational query on base dataset "${baseDataset.name}" with ${populatedJoins.length} join(s)`,
        metadata: {
          baseDataset: baseDataset.name,
          joinedDatasets: populatedJoins.map(j => j.targetDataset.name),
          dimensions: normalizedDimensions,
          rowCount: queryResult.totalCount
        },
        req
      });

      return res.status(200).json({
        success: true,
        data: queryResult.rows,
        rows: queryResult.rows,
        total: queryResult.totalCount,
        totalCount: queryResult.totalCount,
        page: queryResult.page,
        limit: queryResult.limit,
        totalPages: queryResult.totalPages,
        executionTimeMs: queryResult.executionTimeMs
      });
    } catch (err) {
      console.error('[RelationshipController.executeRelationalQuery] Error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Relational query execution failed.',
        error: err.message
      });
    }
  }
};

module.exports = relationshipController;
