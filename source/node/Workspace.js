const { TextDatasource } = require("@buttercup/datasources");
const { getQueue } = require("./Queue.js");
const Archive = require("./Archive.js");
const ArchiveComparator = require("./ArchiveComparator.js");
const Inigo = require("./Inigo.js");
const { extractSharesFromHistory } = require("./tools/sharing.js");
const { stripDestructiveCommands } = require("./tools/history.js");
const { initialiseShares } = require("./myButtercup/sharing.js");

/**
 * Extract the command portion of a history item
 * @returns {String} The valid command or an empty string if invalid
 * @param {String} fullCommand The command to process
 * @private
 * @static
 * @memberof Workspace
 */
function getCommandType(fullCommand) {
    return fullCommand && fullCommand.length >= 3 ? fullCommand.substr(0, 3) : "";
}

/**
 * Workspace class implementation
 * Workspaces organise Archives and Datasources, and perform saves
 * and merges with remote changes.
 */
class Workspace {
    constructor() {
        this._archive = null;
        this._datasource = null;
        this._masterCredentials = null;
        this._shares = [];
    }

    /**
     * The archive instance
     * @type {Archive}
     * @memberof Workspace
     */
    get archive() {
        return this._archive;
    }

    /**
     * The datasource instance for the archive
     * @type {TextDatasource}
     * @memberof Workspace
     */
    get datasource() {
        return this._datasource;
    }

    /**
     * The master credentials for the archive
     * @type {Credentials}
     * @memberof Workspace
     */
    get masterCredentials() {
        return this._masterCredentials;
    }

    /**
     * The saving/updating channel for queuing workspace async actions
     * @type {Channel}
     * @memberof Workspace
     */
    get channel() {
        const topicID = this.archive.id;
        return getQueue().channel(`workspace:${topicID}`);
    }

    /**
     * Current workspace share instances
     * @type {Array.<Share>}
     * @memberof Workspace
     */
    get shares() {
        return this._shares;
    }

    /**
     * Detect whether the local archives (in memory) differ from their remote copies
     * Fetches the remote copies from their datasources and detects differences between
     * them and their local counterparts. Does not change/update the local items.
     * @returns {Promise.<Boolean>} A promise that resolves with a boolean - true if
     *      there are differences, false if there is not
     * @memberof Workspace
     */
    localDiffersFromRemote() {
        if (typeof this.datasource.localDiffersFromRemote === "function") {
            return this.datasource.localDiffersFromRemote(this.masterCredentials, this.archive.getHistory());
        }
        if (this.datasource.toObject().type !== "text") {
            // Only clear if not a TextDatasource
            this.datasource.setContent("");
        }
        return this.datasource
            .load(this.masterCredentials)
            .then(history => Archive.createFromHistory(history))
            .then(loadedItem => {
                const comparator = new ArchiveComparator(this.archive, loadedItem);
                return comparator.archivesDiffer();
            });
    }

    /**
     * Merge remote contents
     * Detects differences between a local and a remote item, and merges the
     * two copies together.
     * @returns {Promise.<Archive>} A promise that resolves with the newly merged archive -
     *      This archive is automatically saved over the original local copy.
     * @memberof Workspace
     */
    mergeFromRemote() {
        if (this.datasource.toObject().type !== "text") {
            // Only clear if not a TextDatasource
            this.datasource.setContent("");
        }
        return this.datasource
            .load(this.masterCredentials)
            .then(history => Archive.createFromHistory(history))
            .then(stagedArchive => {
                const comparator = new ArchiveComparator(this.archive, stagedArchive);
                const differences = comparator.calculateDifferences();
                // only strip if there are multiple updates
                const stripDestructive = differences.secondary.length > 0;
                const newHistoryMain = stripDestructive
                    ? stripDestructiveCommands(differences.original)
                    : differences.original;
                const newHistoryStaged = stripDestructive
                    ? stripDestructiveCommands(differences.secondary)
                    : differences.secondary;
                const base = differences.common;
                const newArchive = new Archive();
                newArchive._getWestley().initialise();
                // merge all history and execute on new archive
                base.concat(newHistoryStaged)
                    .concat(newHistoryMain)
                    .forEach(function(command) {
                        newArchive._getWestley().execute(command);
                    });
                newArchive._getWestley().clearDirtyState();
                this._archive = newArchive;
                return newArchive;
            });
    }

    /**
     * Save the archive to the remote
     * @returns {Promise} A promise that resolves when saving has completed
     * @memberof Workspace
     */
    save() {
        return this.channel.enqueue(
            () =>
                this.datasource.save(this.archive.getHistory(), this.masterCredentials).then(() => {
                    this.archive._getWestley().clearDirtyState();
                }),
            /* priority */ undefined,
            /* stack */ "saving"
        );
    }

    /**
     * Set the archive and its accompanying data on the workspace
     * @param {Archive} archive The archive instance
     * @param {TextDatasource} datasource The datasource for the archive
     * @param {*} masterCredentials The master credentials for the archive
     * @memberof Workspace
     */
    setArchive(archive, datasource, masterCredentials) {
        this._archive = archive;
        this._datasource = datasource;
        this._masterCredentials = masterCredentials;
    }

    /**
     * Update the archive
     * @returns {Promise} A promise that resolves once the update has
     *  completed
     * @memberof Workspace
     */
    update({ skipDiff = false } = {}) {
        return this.channel.enqueue(
            () =>
                (skipDiff ? Promise.resolve() : this.localDiffersFromRemote())
                    .then(differs => {
                        if (differs) {
                            return this.mergeFromRemote();
                        }
                    })
                    .then(() => initialiseShares(this)),
            /* priority */ undefined,
            /* stack */ "updating"
        );
    }

    /**
     * Update the master password of the archive
     * @param {Credentials} masterCredentials The new credentials
     * @memberof Workspace
     */
    updatePrimaryCredentials(masterCredentials) {
        this._masterCredentials = masterCredentials;
    }

    _applyShares() {
        this._shares.forEach(share => {
            if (!share.archiveHasAppliedShare(this.archive)) {
                share.applyToArchive(this.archive);
            }
        });
    }

    _unloadShares() {
        const westley = this._archive._getWestley();
        const extractedShares = extractSharesFromHistory(westley.history);
        // Reset archive history (without shares)
        const { base } = extractedShares;
        delete extractedShares.base;
        westley.initialise();
        base.forEach(line => westley.execute(line));
        // Update share payloads
        Object.keys(extractedShares).forEach(shareID => {
            const share = this._shares.find(share => share.id === shareID);
            if (!share) {
                throw new Error(`Failed updating extracted share: No share found in workspace for ID: ${shareID}`);
            }
            share.updateHistory(extractedShares[shareID]);
        });
    }
}

module.exports = Workspace;
