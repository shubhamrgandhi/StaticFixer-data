const Helpers = require('../helpers/esSourceHelpers')
const { workTableJoins, instanceTableJoins } = require('../helpers/apiConstants')
const { DBConnection } = require('./db')

/** Class representing a search object. */
class V3Work {
  /**
   * Create a search object.
   *
   * @param {Object} app Express object, contains various components needed for search.
   * @param {Object} params Object containing search request from user.
   */
  constructor(app, params) {
    this.app = app
    this.params = params
    this.logger = this.app.logger
    this.dbConn = new DBConnection(this.logger, app.dbClient)
  }

  /**
   * Executes a search against the ElasticSearch index
   *
   * @returns {Promise} Promise object representing the result of the search request
   */
  parseWork(work, params) {
    let { recordType } = params
    if (!recordType) { recordType = 'editions' }
    const fetchObj = this.getInstanceOrEditions(work)
    const dbWork = this.loadWork(fetchObj, recordType, workTableJoins)

    return dbWork
  }

  /**
   * Method to load and format an object containing work metadata from the database
   *
   * @param {object} work Parsed work object containing identifiers to be retrieved
   * @param {*} recordType Inner doc type to be included. Either instances or editions
   * @param {array} joins Array of strings identifying tables to be joined to this query
   *
   * @returns {object} Constructed work record that can be sent to the end user
   */
  async loadWork(work, recordType, joins) {
    const dbWork = await this.getWork(work.uuid, joins)
    const identifiers = await this.getIdentifiers('work', dbWork.id)
    dbWork.identifiers = identifiers
    dbWork.instances = null
    dbWork.editions = null
    dbWork.edition_count = 0
    dbWork.edition_range = work.edition_range

    const getFunc = `get${recordType.slice(0, 1).toUpperCase()}${recordType.slice(1)}`
    const innerIds = new Set(work.instanceIds.map(ids => ids[`${recordType.slice(0, -1)}_id`]))
    dbWork[recordType] = await this[getFunc]([...innerIds])
    dbWork.edition_count = innerIds.size
    Helpers.parseAgents(dbWork, recordType)
    Helpers.parseLinks(dbWork, recordType)
    Helpers.parseDates(dbWork, recordType)

    return dbWork
  }

  /**
   * Handler function to retrieve work record through the DBConnection class
   *
   * @param {string} uuid Work UUID
   * @param {array} relatedTables Array of tables to load related metadata records from
   *
   * @returns {object} Database work record
   */
  getWork(uuid, relatedTables) {
    return this.dbConn.loadWork(uuid, relatedTables)
  }

  /**
   * Handler function to retrieve identifiers for a specified row through the
   * DBConnection class
   *
   * @param {string} table Name of the table to retrieve related identifiers. Should
   * generally be either works or instances (other option is items)
   * @param {integer} identifier Row ID in the specified table to retrieve identifiers for
   *
   * @returns {array} Array of identifier objects with id_type and identifier values
   */
  getIdentifiers(table, identifier) {
    return this.dbConn.loadIdentifiers(table, identifier)
  }

  /**
   * Handler function for retrieving a set of editions specified by their internal
   * postgres row ids through the DBConnection class
   *
   * @param {array} editionIds Array of Row IDs to the editions table
   *
   * @returns {array} Array of edition objects from the database
   */
  getEditions(editionIds) {
    return this.dbConn.loadEditions(editionIds, editionIds.length)
  }

  /**
   * Handler function for retrieving a set of instances specified by their internal
   * postgres row ids through the DBConnection class
   *
   * @param {array} editionIds Array of Row IDs to the instances table
   *
   * @returns {array} Array of instance objects from the database
   */
  getInstances(instanceIds) {
    // instanceTableJoins is loaded from the helpers/apiConstants file
    return this.dbConn.loadInstances(instanceIds, instanceIds.length, instanceTableJoins)
  }

  /**
   * Method to parse ElasticSearch object into actionable object containing identifiers
   * for lookup in the database. This includes a UUID for the work and row ids for
   * edition and instances records. Other metadata that can be extracted from ElasticSearch
   * is pulled out as well. Any "empty" instances are filtered from the returned object
   *
   * @param {object} resp ElasticSearch response object
   *
   * @returns {object} A formatted object containing identifiers for retrieval from
   * the database
   */
  getInstanceOrEditions(work) {
    /* eslint-disable no-underscore-dangle */
    const dbRec = {
      uuid: work._id,
      edition_range: Helpers.formatSingleResponseEditionRange(work),
      instanceIds: [],
    }

    const instances = []

    if (work.inner_hits) {
      Object.values(work.inner_hits).forEach((match) => {
        match.hits.hits.forEach((inner) => {
          const instanceOffset = inner._nested.offset
          instances.push(work._source.instances[instanceOffset])
        })
      })
    } else {
      instances.push(...work._source.instances)
    }

    instances.sort((a, b) => {
      if (a.pub_date === undefined) return 1
      if (b.pub_date === undefined) return -1
      if (a.pub_date.gte < b.pub_date.gte) return -1
      return 1
    })

    const { showAll } = this.params

    instances.forEach((inst) => {
      const itemPresent = inst.formats && inst.formats.length > 0
      const metadataPresent = inst.pub_date
        || (inst.agents && inst.agents.length > 0)
        || inst.pub_place

      if ((showAll === 'false' && itemPresent) || (showAll !== 'false' && (itemPresent || metadataPresent))) {
        dbRec.instanceIds.push({
          instance_id: inst.instance_id,
          edition_id: inst.edition_id,
        })
      }
    })

    return dbRec
    /* eslint-enable no-underscore-dangle */
  }
}

module.exports = { V3Work }
